#!/usr/bin/env bash
# Independently verify and RESTORE an offsite PostgreSQL dump on a disposable
# networkless Postgres container. Does not require a live Apartment DB at all.
set -Eeuo pipefail
umask 077
(( EUID == 0 )) || { echo 'ERROR: root required' >&2; exit 2; }
(( $# == 1 )) || { echo 'Usage: restore-offsite-apartment-postgres.sh apartment-YYYYMMDDTHHMMSSZ-PID.dump' >&2; exit 2; }
archive="$1"
[[ "$archive" =~ ^apartment-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ]] || { echo 'ERROR: invalid archive name' >&2; exit 2; }
directory="${APARTMENT_RECOVERY_ARCHIVE_DIR:-/root/backups/apartment-postgres}"
[[ "$directory" == /root/backups/* && "$directory" != *..* && "$directory" != */ &&
 -d "$directory" && ! -L "$directory" && "$(stat -c '%u:%a' "$directory")" == 0:700 ]] ||
 { echo 'ERROR: recovery directory must be root-only 0700 under /root/backups/' >&2; exit 2; }
[[ -f "$directory/$archive" && ! -L "$directory/$archive" &&
 -f "$directory/$archive.sha256" && ! -L "$directory/$archive.sha256" &&
 "$(stat -c '%u:%a' "$directory/$archive")" == 0:600 ]] ||
 { echo 'ERROR: missing or insecure decrypted archive' >&2; exit 2; }
[[ "$(cat "$directory/$archive.sha256")" =~ ^[a-f0-9]{64}\ \ $archive$ ]] ||
 { echo 'ERROR: invalid checksum sidecar' >&2; exit 2; }
(cd "$directory" && sha256sum -c --status "$archive.sha256") ||
 { echo 'ERROR: restored archive checksum mismatch' >&2; exit 1; }
command -v docker >/dev/null || { echo 'ERROR: docker is required' >&2; exit 2; }
docker run --rm -i --network none postgres:16-alpine pg_restore -l <"$directory/$archive" >/dev/null ||
 { echo 'ERROR: invalid PostgreSQL custom dump' >&2; exit 1; }
container="apartme-offsite-restore-$$"
cleanup(){ docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$container" --network none \
 --tmpfs /var/lib/postgresql/data:rw,size=384m \
 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
ready=false
for _ in $(seq 1 35); do
 if docker logs "$container" 2>&1 | grep -q 'PostgreSQL init process complete' &&
    docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
  ready=true; break
 fi
 sleep 1
done
[[ "$ready" == true ]] || { echo 'ERROR: isolated restore not ready' >&2; exit 1; }
docker exec -i "$container" pg_restore -U postgres -d postgres \
 --no-owner --no-acl --exit-on-error <"$directory/$archive"
tables="$(docker exec "$container" psql -U postgres -d postgres -Atc \
 "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
[[ "$tables" =~ ^[0-9]+$ && "$tables" -gt 0 ]] ||
 { echo 'ERROR: restore contains no application tables' >&2; exit 1; }
echo "OFFSITE_ISOLATED_RESTORE_PASS tables=$tables network=none live_database_access=none"
