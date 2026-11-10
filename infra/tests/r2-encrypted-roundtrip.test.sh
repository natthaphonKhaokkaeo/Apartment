#!/usr/bin/env bash
# Real age + rclone ciphertext roundtrip and a PostgreSQL restore in an
# isolated --network=none disposable Docker container. Never reaches Cloudflare.
set -Eeuo pipefail
umask 077
(( EUID == 0 )) || { echo 'SKIP: requires root'; exit 0; }
cd "$(dirname "$0")/../.."
for utility in age age-keygen rclone docker sha256sum; do
 command -v "$utility" >/dev/null || { echo "ERROR: missing $utility" >&2; exit 2; }
done
source_dir=/root/backups/apartment-postgres
[[ -d "$source_dir" && ! -L "$source_dir" ]] || { echo 'ERROR: no local source backup' >&2; exit 2; }
archive="$(find "$source_dir" -maxdepth 1 -type f -name 'apartment-*.dump' -printf '%f\n' | LC_ALL=C sort -r | head -1)"
[[ "$archive" =~ ^apartment-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ]] || exit 2
bash infra/backup-apartment-postgres.sh verify "$archive" >/dev/null
scratch="$(mktemp -d /root/backups/.apartment-r2-test-XXXXXXXX)"
cleanup(){ rm -rf -- "$scratch"; }
trap cleanup EXIT
install -d -m 0700 "$scratch/remote" "$scratch/recovered"
# This private identity exists ONLY for the local test; it is never copied
# to /etc/apartment or kept after cleanup.
age-keygen -o "$scratch/test-only-identity" 2>/dev/null
recipient="$(age-keygen -y "$scratch/test-only-identity")"
cat >"$scratch/rclone.conf" <<'CONF'
[mock-local-r2]
type = local
CONF
chmod 0600 "$scratch/rclone.conf"
export RCLONE_CONFIG="$scratch/rclone.conf"
export APARTMENT_OFFSITE_AGE_RECIPIENT="$recipient"
export APARTMENT_OFFSITE_REMOTE="mock-local-r2:$scratch/remote"
# Exercises the existing production encryption+upload and remote ciphertext
# readback steps against a real rclone local backend.
bash infra/offsite-apartment-postgres.sh upload "$archive" >/dev/null
[[ -f "$scratch/remote/$archive.age" ]] || exit 1
[[ "$(head -c 3 "$scratch/remote/$archive.age")" == age ]] || { echo 'ERROR: not an age envelope'; exit 1; }
rclone cat "$APARTMENT_OFFSITE_REMOTE/$archive.age" | age -d -i "$scratch/test-only-identity" >"$scratch/recovered/$archive"
chmod 0600 "$scratch/recovered/$archive"
cp -- "$source_dir/$archive.sha256" "$scratch/recovered/$archive.sha256"
(cd "$scratch/recovered" && sha256sum -c --status "$archive.sha256")
APARTMENT_RECOVERY_ARCHIVE_DIR="$scratch/recovered" bash infra/restore-offsite-apartment-postgres.sh "$archive" >"$scratch/restore.log"
grep -q 'OFFSITE_ISOLATED_RESTORE_PASS' "$scratch/restore.log"
echo 'R2_OFFLINE_ROUNDTRIP_RESTORE_PASS real_age=true real_rclone=true checksum=true postgres_restore=true disposable_network=none cloud_requests=0'
