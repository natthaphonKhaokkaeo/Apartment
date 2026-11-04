#!/usr/bin/env bash
# Apartment-only PostgreSQL backups. Source database is never modified.
set -Eeuo pipefail
umask 077
DB_CONTAINER=apartment-dev-postgres-1
BACKUP_DIR="${APARTMENT_BACKUP_DIR:-/root/backups/apartment-postgres}"
LOCK_FILE=/run/lock/apartment-postgres-backup.lock
RETENTION_DAYS="${APARTMENT_BACKUP_RETENTION_DAYS:-14}"
[[ "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ && "$RETENTION_DAYS" -le 3650 ]] || { echo "ERROR: invalid retention" >&2; exit 2; }
COMMAND=backup
if (( $# > 0 )); then COMMAND="$1"; fi
if (( EUID != 0 )); then echo 'ERROR: root required' >&2; exit 2; fi
case "$COMMAND" in backup|verify|restore-test);; *) echo 'usage: script [backup|verify|restore-test] [archive filename]' >&2; exit 2;; esac
install -d -m 0700 "$BACKUP_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo 'BACKUP_ALREADY_RUNNING'; exit 3; }

latest_archive() {
 find "$BACKUP_DIR" -maxdepth 1 -type f -name 'apartment-*.dump' -printf '%f\n' |
 LC_ALL=C sort -r | head -1
}
verify_archive() {
 local name="$1" file
 [[ "$name" =~ ^apartment-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ]] ||
  { echo 'ERROR: invalid archive name' >&2; return 2; }
 file="$BACKUP_DIR/$name"
 [[ -f "$file" && ! -L "$file" && -f "$file.sha256" ]] ||
  { echo 'ERROR: missing archive/checksum' >&2; return 2; }
 (cd "$BACKUP_DIR" && sha256sum -c --status "$name.sha256") ||
  { echo 'ERROR: checksum mismatch' >&2; return 1; }
 docker exec -i "$DB_CONTAINER" pg_restore -l < "$file" > /dev/null ||
  { echo 'ERROR: broken PostgreSQL archive' >&2; return 1; }
 printf 'BACKUP_VERIFIED file=%s bytes=%s\n' "$name" "$(stat -c %s "$file")"
}
case "$COMMAND" in
 backup)
  name="apartment-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
  tmp="$(mktemp "$BACKUP_DIR/.apartment-XXXXXXXX.partial")"
  trap 'rm -f -- "$tmp"' EXIT
  docker inspect "$DB_CONTAINER" --format '{{.State.Running}}' | grep -qx true
  docker exec "$DB_CONTAINER" pg_dump -U apartment -d apartment \
    --format=custom --no-owner --no-acl --compress=6 > "$tmp"
  [[ -s "$tmp" ]] || { echo 'ERROR: empty backup' >&2; exit 1; }
  docker exec -i "$DB_CONTAINER" pg_restore -l < "$tmp" > /dev/null
  chmod 0600 "$tmp"
  mv -n "$tmp" "$BACKUP_DIR/$name"
  trap - EXIT
  (cd "$BACKUP_DIR" && sha256sum "$name" > "$name.sha256")
  chmod 0600 "$BACKUP_DIR/$name.sha256"
  verify_archive "$name"
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'apartment-*.dump' \
    -mtime "+$((RETENTION_DAYS - 1))" -print0 |
    while IFS= read -r -d '' archive; do
      # The newly verified backup is never eligible for deletion.
      [[ "$archive" == "$BACKUP_DIR/$name" ]] && continue
      [[ "$(basename "$archive")" =~ ^apartment-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ]] || continue
      rm -f -- "$archive" "$archive.sha256"
    done
  printf 'BACKUP_OK retention_days=%s\n' "$RETENTION_DAYS"
  ;;
 verify)
  archive="$(latest_archive)"
  if (( $# > 1 )); then archive="$2"; fi
  verify_archive "$archive"
  ;;
 restore-test)
  archive="$(latest_archive)"
  if (( $# > 1 )); then archive="$2"; fi
  verify_archive "$archive"
  disposable="apartment-restore-verify-$$"
  cleanup() { docker rm -f "$disposable" > /dev/null 2>&1 || true; }
  trap cleanup EXIT
  docker run -d --name "$disposable" --network none \
    --tmpfs /var/lib/postgresql/data:rw,size=384m \
    -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine > /dev/null
  ready=false
  for _ in $(seq 1 35); do
    # postgres official image runs a transient init server then restarts it.
    # Wait for that phase to finish before accepting pg_isready to avoid a race.
    if docker logs "$disposable" 2>&1 | grep -q 'PostgreSQL init process complete' \
      && docker exec "$disposable" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
      ready=true; break
    fi
    sleep 1
  done
  [[ "$ready" == true ]] || { echo 'ERROR: isolated restore DB not ready' >&2; exit 1; }
  docker exec -i "$disposable" pg_restore -U postgres -d postgres \
    --no-owner --no-acl --exit-on-error < "$BACKUP_DIR/$archive"
  tables="$(docker exec "$disposable" psql -U postgres -d postgres -Atc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
  [[ "$tables" =~ ^[0-9]+$ && "$tables" -gt 0 ]] ||
    { echo 'ERROR: restore contains no tables' >&2; exit 1; }
  printf 'RESTORE_TEST_OK restored_public_tables=%s network=none\n' "$tables"
  ;;
esac
