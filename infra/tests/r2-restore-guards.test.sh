#!/usr/bin/env bash
# Recovery fail-closed checks. Never starts a Docker container on invalid input.
set -Eeuo pipefail
(( EUID == 0 )) || { echo 'SKIP: root required'; exit 0; }
cd "$(dirname "$0")/../.."
script=infra/restore-offsite-apartment-postgres.sh
scratch="$(mktemp -d /root/backups/.apartment-r2-guards-XXXXXXXX)"
trap 'rm -rf -- "$scratch"' EXIT
chmod 0700 "$scratch"
archive=apartment-20261108T010000Z-321.dump
printf 'not a postgres archive\n' >"$scratch/$archive"
printf '%064d  %s\n' 0 "$archive" >"$scratch/$archive.sha256"
chmod 0600 "$scratch/$archive" "$scratch/$archive.sha256"
expect_fail(){
 if "$@" >/dev/null 2>&1; then echo 'ERROR: invalid restore input was accepted' >&2; exit 1; fi
}
expect_fail env APARTMENT_RECOVERY_ARCHIVE_DIR="$scratch" bash "$script" ../other.dump
expect_fail env APARTMENT_RECOVERY_ARCHIVE_DIR="$scratch" bash "$script" "$archive"
chmod 0644 "$scratch/$archive"
expect_fail env APARTMENT_RECOVERY_ARCHIVE_DIR="$scratch" bash "$script" "$archive"
chmod 0600 "$scratch/$archive"
printf 'bad\n' >"$scratch/$archive.sha256"
expect_fail env APARTMENT_RECOVERY_ARCHIVE_DIR="$scratch" bash "$script" "$archive"
ln -s "$scratch" "$scratch-link"
expect_fail env APARTMENT_RECOVERY_ARCHIVE_DIR="$scratch-link" bash "$script" "$archive"
rm "$scratch-link"
echo 'R2_RESTORE_GUARDS_PASS bad_filename=blocked bad_checksum=blocked insecure_permissions=blocked symlink=blocked live_db_unchanged=true'
