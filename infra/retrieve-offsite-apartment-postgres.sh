#!/usr/bin/env bash
# Securely retrieve an encrypted Apartment dump; NEVER restore over a live DB.
# Run on a recovery machine with age private identity and rclone configured.
set -Eeuo pipefail
umask 077
(( EUID == 0 )) || { echo 'ERROR: root required' >&2; exit 2; }
(( $# == 1 )) || { echo 'usage: retrieve-offsite-apartment-postgres.sh <archive filename>' >&2; exit 2; }
archive="$1"
[[ "$archive" =~ ^apartment-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ]] ||
 { echo 'ERROR: invalid archive filename' >&2; exit 2; }
remote="${APARTMENT_OFFSITE_REMOTE:-}"
identity="${APARTMENT_OFFSITE_AGE_IDENTITY:-}"
[[ "$remote" =~ ^[A-Za-z0-9_-]+:[A-Za-z0-9_./-]+$ && "$remote" != *..* && "$remote" != */ ]] ||
 { echo 'ERROR: invalid remote' >&2; exit 2; }
[[ "$identity" == /* && -f "$identity" && ! -L "$identity" ]] ||
 { echo 'ERROR: invalid age identity path' >&2; exit 2; }
mode="$(stat -c '%a' "$identity")"
[[ "$(stat -c '%u' "$identity")" == 0 ]] ||
 { echo 'ERROR: age identity must be owned by root' >&2; exit 2; }
[[ "$mode" == 400 || "$mode" == 600 ]] ||
 { echo 'ERROR: age identity must be owner-only 0400/0600' >&2; exit 2; }
for utility in rclone age docker sha256sum; do
 command -v "$utility" >/dev/null ||
 { echo "ERROR: missing $utility" >&2; exit 2; }
done
target_dir=/root/backups/apartment-postgres
[[ -d "$target_dir" && ! -L "$target_dir" ]] ||
 { echo 'ERROR: recovery backup directory missing' >&2; exit 2; }
exec 9>/run/lock/apartment-postgres-offsite-retrieve.lock
flock -n 9 || { echo 'RETRIEVE_LOCK_BUSY' >&2; exit 3; }
[[ ! -e "$target_dir/$archive" && ! -e "$target_dir/$archive.sha256" ]] ||
 { echo 'ERROR: archive already exists; refusing overwrite' >&2; exit 2; }
tmp="$(mktemp "$target_dir/.retrieve-XXXXXXXX.partial")"
sumtmp="$(mktemp "$target_dir/.retrieve-checksum-XXXXXXXX.partial")"
cleanup(){ rm -f -- "$tmp" "$sumtmp"; }
trap cleanup EXIT
# Authenticated age decryption; no plaintext network transmission.
rclone cat "$remote/$archive.age" | age -d -i "$identity" > "$tmp"
[[ -s "$tmp" ]] || { echo 'ERROR: empty decrypted archive' >&2; exit 1; }
# Verify archive structure without a database or network and without
# restoring any tables to any existing PostgreSQL service.
docker run --rm -i --network none postgres:16-alpine pg_restore -l < "$tmp" >/dev/null ||
 { echo 'ERROR: invalid PostgreSQL archive' >&2; exit 1; }
sha256sum "$tmp" | awk -v name="$archive" '{print $1"  "name}' > "$sumtmp"
chmod 0600 "$tmp" "$sumtmp"
mv -n -- "$tmp" "$target_dir/$archive"
[[ -f "$target_dir/$archive" ]] || { echo 'ERROR: could not install archive' >&2; exit 1; }
mv -n -- "$sumtmp" "$target_dir/$archive.sha256"
(cd "$target_dir" && sha256sum -c --status "$archive.sha256") ||
 { echo 'ERROR: retrieved archive checksum mismatch' >&2; exit 1; }
echo 'OFFSITE_RETRIEVE_PASS decrypted=true postgres_archive_valid=true live_database_mutations=0'
