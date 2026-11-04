#!/usr/bin/env bash
# Root-only tests against approved local archive. Own fixtures only.
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")/../.."
script=infra/local-archive-apartment-postgres.sh
dir=/root/backups/apartment-local-archive
old="apartment-20000101T000000Z-$$.dump.age"
corrupt="apartment-20990101T000000Z-$$.dump.age"
cleanup(){ rm -f -- "$dir/$old" "$dir/$old.sha256" "$dir/$corrupt" "$dir/$corrupt.sha256"; }
trap cleanup EXIT
bash infra/tests/local-backup-config.test.sh
bash "$script" archive
current="$(find "$dir" -maxdepth 1 -name 'apartment-*.dump.age' -printf '%f\n' | sort -r | head -1)"
cp "$dir/$current" "$dir/$old"
(cd "$dir" && sha256sum "$old" > "$old.sha256")
touch -d '40 days ago' "$dir/$old"
bash "$script" archive
[[ ! -e "$dir/$old" && -f "$dir/$current" ]]
echo BACKUP_RETENTION_REAL_TEST_PASS
printf 'corrupt test ciphertext' > "$dir/$corrupt"
(cd "$dir" && sha256sum "$corrupt" > "$corrupt.sha256")
printf 'modified' >> "$dir/$corrupt"
if bash "$script" check >/tmp/apartment-corrupt-test.log 2>&1; then
 echo 'ERROR: corruption accepted'; exit 1
fi
rm -f -- "$dir/$corrupt" "$dir/$corrupt.sha256"
if APARTMENT_BACKUP_MAX_DISK_PERCENT=10 bash "$script" check >/tmp/apartment-disk-test.log 2>&1; then
 echo 'ERROR: disk threshold accepted'; exit 1
fi
grep -q 'disk threshold exceeded' /tmp/apartment-disk-test.log
# Hold the same lock; nested process must fail without writing.
(
 flock -n 8
 set +e
 bash "$script" archive >/tmp/apartment-lock-test.log 2>&1
 result=$?
 set -e
 [[ "$result" == 3 ]]
) 8>/run/lock/apartment-local-archive.lock
bash "$script" check
echo BACKUP_CORRUPTION_DISK_LOCK_TEST_PASS
