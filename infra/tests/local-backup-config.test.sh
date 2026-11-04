#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
script=infra/local-archive-apartment-postgres.sh
# Invalid configuration must fail before touching real archives.
if APARTMENT_ARCHIVE_RETENTION_DAYS=0 bash "$script" check >/tmp/apartment-invalid-retention.log 2>&1; then
 echo 'FAIL invalid retention accepted'; exit 1
fi
grep -q 'invalid retention' /tmp/apartment-invalid-retention.log
if APARTMENT_BACKUP_MAX_AGE_HOURS=0 bash "$script" check >/tmp/apartment-invalid-age.log 2>&1; then
 echo 'FAIL invalid age accepted'; exit 1
fi
grep -q 'invalid maximum age' /tmp/apartment-invalid-age.log
echo LOCAL_BACKUP_CONFIG_TEST_PASS
