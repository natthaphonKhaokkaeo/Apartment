#!/usr/bin/env bash
# Apartment P0 encrypted, fail-closed offsite shipment. Never modifies source DB.
set -Eeuo pipefail
umask 077
readonly BACKUP_DIR=/root/backups/apartment-postgres
readonly LOCK_FILE=/run/lock/apartment-postgres-offsite.lock
usage(){ echo 'Usage: offsite-apartment-postgres.sh check|upload [archive name]' >&2; exit 2; }
(( EUID == 0 )) || { echo 'ERROR: root required' >&2; exit 2; }
(( $# >= 1 && $# <= 2 )) || usage
command="$1"
[[ "$command" == check || "$command" == upload ]] || usage
[[ -d "$BACKUP_DIR" && ! -L "$BACKUP_DIR" ]] || { echo 'ERROR: trusted backup directory missing' >&2; exit 2; }
exec 9>"$LOCK_FILE"
flock -n 9 || { echo 'OFFSITE_LOCK_BUSY' >&2; exit 3; }
recipient="${APARTMENT_OFFSITE_AGE_RECIPIENT:-}"
remote="${APARTMENT_OFFSITE_REMOTE:-}"
[[ "$recipient" =~ ^age1[0-9a-z]{58}$ ]] || { echo 'ERROR: invalid age public recipient configuration' >&2; exit 2; }
[[ "$remote" =~ ^[A-Za-z0-9_-]+:[A-Za-z0-9_./-]+$ && "$remote" != *..* && "$remote" != */ ]] ||
 { echo 'ERROR: invalid rclone destination' >&2; exit 2; }
for utility in age rclone sha256sum; do
 command -v "$utility" >/dev/null || { echo "ERROR: missing $utility" >&2; exit 2; }
done
if [[ $# == 2 ]]; then
 archive="$2"
else
 archive="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'apartment-*.dump' -printf '%f\n' | LC_ALL=C sort -r | head -1)"
fi
[[ "$archive" =~ ^apartment-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ]] ||
 { echo 'ERROR: invalid archive filename' >&2; exit 2; }
[[ -f "$BACKUP_DIR/$archive" && ! -L "$BACKUP_DIR/$archive" &&
 -f "$BACKUP_DIR/$archive.sha256" && ! -L "$BACKUP_DIR/$archive.sha256" ]] ||
 { echo 'ERROR: missing backup archive or checksum' >&2; exit 2; }
(cd "$BACKUP_DIR" && sha256sum --status -c "$archive.sha256") ||
 { echo 'ERROR: local backup checksum failed' >&2; exit 1; }
if [[ "$command" == check ]]; then
 echo 'OFFSITE_PREFLIGHT_PASS local_checksum=valid encrypted_upload=not_started'
 exit 0
fi
tmp="$(mktemp "$BACKUP_DIR/.offsite-XXXXXXXX.age")"
cleanup(){ rm -f -- "$tmp"; }
trap cleanup EXIT
age -r "$recipient" -o "$tmp" -- "$BACKUP_DIR/$archive"
[[ -s "$tmp" ]] || { echo 'ERROR: encrypted payload empty' >&2; exit 1; }
local_hash="$(sha256sum "$tmp" | cut -d' ' -f1)"
remote_object="$remote/$archive.age"
rclone copyto --immutable "$tmp" "$remote_object" >/dev/null
remote_hash="$(rclone cat "$remote_object" | sha256sum | cut -d' ' -f1)"
[[ "$local_hash" == "$remote_hash" ]] ||
 { echo 'ERROR: remote ciphertext verification failed' >&2; exit 1; }
echo 'OFFSITE_UPLOAD_PASS encrypted=true remote_ciphertext_verified=true plaintext_uploaded=false'
