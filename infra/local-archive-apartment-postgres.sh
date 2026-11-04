#!/usr/bin/env bash
# Approved same-VPS encrypted archive. This is NOT independent offsite DR.
set -Eeuo pipefail
umask 077
(( EUID == 0 )) || { echo 'ERROR: root required' >&2; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE=/root/backups/apartment-postgres
ARCHIVE=/root/backups/apartment-local-archive
IDENTITY=/etc/apartment/backup-age.key
CONFIG=/etc/apartment/backup.env
retention_override="${APARTMENT_ARCHIVE_RETENTION_DAYS-}"
age_override="${APARTMENT_BACKUP_MAX_AGE_HOURS-}"
disk_override="${APARTMENT_BACKUP_MAX_DISK_PERCENT-}"
if [[ -e "$CONFIG" ]]; then
 [[ ! -L "$CONFIG" && "$(stat -c %u:%a "$CONFIG")" == 0:600 ]] || { echo 'ERROR: insecure config' >&2; exit 2; }
 source "$CONFIG"
fi
retention="${retention_override:-${APARTMENT_ARCHIVE_RETENTION_DAYS:-30}}"
max_age="${age_override:-${APARTMENT_BACKUP_MAX_AGE_HOURS:-26}}"
max_disk="${disk_override:-${APARTMENT_BACKUP_MAX_DISK_PERCENT:-85}}"
[[ "$retention" =~ ^[1-9][0-9]*$ && "$retention" -le 3650 ]] || { echo 'ERROR: invalid retention' >&2; exit 2; }
[[ "$max_age" =~ ^[1-9][0-9]*$ && "$max_age" -le 8760 ]] || { echo 'ERROR: invalid maximum age' >&2; exit 2; }
[[ "$max_disk" =~ ^[1-9][0-9]$ ]] || { echo 'ERROR: invalid disk threshold' >&2; exit 2; }
command="${1:-check}"
case "$command" in archive|check|restore-test);; *) echo 'ERROR: command must be archive, check or restore-test' >&2; exit 2;; esac
tmp=
cleanup(){ [[ -z "$tmp" ]] || rm -f -- "$tmp"; }
failed(){ logger -p user.err -t apartment-backup "BACKUP_ALERT action=$command failed exit=$1"; }
trap cleanup EXIT
trap 'failed $?' ERR
for dir in "$SOURCE" "$ARCHIVE"; do
 [[ ! -L "$dir" ]] || { echo 'ERROR: directory symlink refused' >&2; exit 2; }
 install -d -m 0700 "$dir"
 [[ "$(stat -c %u:%a "$dir")" == 0:700 ]] || { echo 'ERROR: insecure directory' >&2; exit 2; }
done
exec 8>/run/lock/apartment-local-archive.lock
flock -n 8 || { echo ARCHIVE_LOCK_BUSY >&2; exit 3; }
[[ -f "$IDENTITY" && ! -L "$IDENTITY" && "$(stat -c %u:%a "$IDENTITY")" == 0:600 ]] || { echo 'ERROR: missing or insecure recovery identity' >&2; exit 2; }
recipient="$(age-keygen -y "$IDENTITY")"
disk="$(df --output=pcent "$ARCHIVE" | tail -1 | tr -dc '0-9')"
if (( disk >= max_disk )); then
 logger -p user.err -t apartment-backup "BACKUP_ALERT disk_percent=$disk threshold=$max_disk"
 echo 'ERROR: backup disk threshold exceeded' >&2; exit 1
fi
latest(){ find "$1" -maxdepth 1 -type f -name "$2" -printf '%f\n' | LC_ALL=C sort -r | head -1; }
verify_cipher(){
 local name="$1"
 [[ "$name" =~ ^apartment-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump\.age$ ]] || return 2
 [[ -f "$ARCHIVE/$name" && ! -L "$ARCHIVE/$name" && -f "$ARCHIVE/$name.sha256" && ! -L "$ARCHIVE/$name.sha256" ]] || return 2
 # Strict sidecar format prevents sha256sum from following attacker-controlled paths.
 [[ "$(cat "$ARCHIVE/$name.sha256")" =~ ^[a-f0-9]{64}\ \ $name$ ]] || return 2
 (cd "$ARCHIVE" && sha256sum -c --status "$name.sha256")
 [[ "$(stat -c %u:%a "$ARCHIVE/$name")" == 0:600 ]]
}
if [[ "$command" == archive ]]; then
 name="$(latest "$SOURCE" 'apartment-*.dump')"
 bash "$ROOT/infra/backup-apartment-postgres.sh" verify "$name"
 target="$name.age"
 if [[ -e "$ARCHIVE/$target" ]]; then
  verify_cipher "$target"
 else
  tmp="$(mktemp "$ARCHIVE/.encrypt-XXXXXXXX")"
  age -r "$recipient" -o "$tmp" "$SOURCE/$name"
  # Confirm authenticated decryption matches the original BEFORE publication/retention.
  original="$(sha256sum "$SOURCE/$name" | cut -d' ' -f1)"
  recovered="$(age -d -i "$IDENTITY" "$tmp" | sha256sum | cut -d' ' -f1)"
  [[ "$original" == "$recovered" ]]
  mv -n "$tmp" "$ARCHIVE/$target"
  tmp=
  (cd "$ARCHIVE" && sha256sum "$target" > "$target.sha256")
 fi
 verify_cipher "$target"
 original="$(sha256sum "$SOURCE/$name" | cut -d' ' -f1)"
 # Repeated archive runs also verify the current identity before any retention.
 recovered="$(age -d -i "$IDENTITY" "$ARCHIVE/$target" | sha256sum | cut -d' ' -f1)"
 [[ "$original" == "$recovered" ]]
 # Preserve a plaintext checksum beside ciphertext so recovery never depends on source availability.
 printf '%s  %s\n' "$original" "$name" > "$ARCHIVE/$target.plaintext.sha256"
 chmod 0600 "$ARCHIVE/$target.plaintext.sha256"
 # Preserve current verified archive even when all other entries have expired.
 while IFS= read -r -d '' old; do
  [[ "$(basename "$old")" == "$target" ]] && continue
  [[ "$(basename "$old")" =~ ^apartment-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump\.age$ ]] || continue
  rm -f -- "$old" "$old.sha256" "$old.plaintext.sha256"
 done < <(find "$ARCHIVE" -maxdepth 1 -type f -name 'apartment-*.dump.age' -mtime "+$((retention - 1))" -print0)
 echo 'BACKUP_ENCRYPTION_PASS BACKUP_RETENTION_PASS scope=same-vps'
fi
name="$(latest "$ARCHIVE" 'apartment-*.dump.age')"
verify_cipher "$name"
# Fresh encryption of an old dump must never reset the backup RPO.
stamp="${name#apartment-}"
backup_epoch="$(date -u -d "${stamp:0:4}-${stamp:4:2}-${stamp:6:2} ${stamp:9:2}:${stamp:11:2}:${stamp:13:2} UTC" +%s)"
age_seconds=$(( $(date +%s) - backup_epoch ))
(( age_seconds >= 0 && age_seconds <= max_age * 3600 )) || { logger -p user.err -t apartment-backup 'BACKUP_ALERT archive_stale'; echo 'ERROR: stale archive' >&2; exit 1; }
echo "BACKUP_CHECKSUM_PASS BACKUP_MONITORING_PASS disk_percent=$disk age_seconds=$age_seconds"
if [[ "$command" == restore-test ]]; then
 # Existing isolated restore routine is reused; it can only restore to its disposable container.
 recovery="$(mktemp -d /root/backups/.apartment-restore-XXXXXXXX)"
 cleanup_recovery(){ rm -f -- "$recovery/$plain" "$recovery/$plain.sha256"; rmdir "$recovery"; }
 plain="${name%.age}"
 trap 'cleanup; cleanup_recovery' EXIT
 [[ -f "$ARCHIVE/$name.plaintext.sha256" && ! -L "$ARCHIVE/$name.plaintext.sha256" ]]
 [[ "$(cat "$ARCHIVE/$name.plaintext.sha256")" =~ ^[a-f0-9]{64}\ \ $plain$ ]]
 age -d -i "$IDENTITY" -o "$recovery/$plain" "$ARCHIVE/$name"
 cp "$ARCHIVE/$name.plaintext.sha256" "$recovery/$plain.sha256"
 (cd "$recovery" && sha256sum -c --status "$plain.sha256")
 APARTMENT_BACKUP_DIR="$recovery" bash "$ROOT/infra/backup-apartment-postgres.sh" restore-test "$plain"
 echo BACKUP_RESTORE_DRILL_PASS
fi
