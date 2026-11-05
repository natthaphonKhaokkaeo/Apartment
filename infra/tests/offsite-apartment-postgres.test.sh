#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
script=./infra/offsite-apartment-postgres.sh
[[ "$EUID" -eq 0 ]] || { echo 'SKIP: root-only integration test' >&2; exit 0; }
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
mkdir -p "$scratch/bin"
cat >"$scratch/bin/age" <<'FAKE'
#!/usr/bin/env bash
echo 'UNEXPECTED_AGE_EXECUTION' >&2
exit 90
FAKE
cat >"$scratch/bin/rclone" <<'FAKE'
#!/usr/bin/env bash
echo 'UNEXPECTED_RCLONE_EXECUTION' >&2
exit 90
FAKE
chmod 700 "$scratch"/bin/*
recipient="age1$(printf '%058d' 0 | tr '0' q)"
safe_remote='mock:apartment/private-backups'
expect_failure(){
 local label="$1"; shift
 if "$@" >"$scratch/out" 2>&1; then
  echo "FAIL: expected rejection for $label" >&2
  exit 1
 fi
 echo "DENIED: $label"
}
expect_failure missing_configuration env -u APARTMENT_OFFSITE_REMOTE -u APARTMENT_OFFSITE_AGE_RECIPIENT "$script" check
expect_failure invalid_remote env APARTMENT_OFFSITE_AGE_RECIPIENT="$recipient" APARTMENT_OFFSITE_REMOTE='mock:../../escape' "$script" check
expect_failure invalid_archive env PATH="$scratch/bin:$PATH" APARTMENT_OFFSITE_AGE_RECIPIENT="$recipient" APARTMENT_OFFSITE_REMOTE="$safe_remote" "$script" check '../other.dump'
env PATH="$scratch/bin:$PATH" APARTMENT_OFFSITE_AGE_RECIPIENT="$recipient" APARTMENT_OFFSITE_REMOTE="$safe_remote" "$script" check >"$scratch/out" 2>&1 ||
 { cat "$scratch/out" >&2; exit 1; }
grep -q 'OFFSITE_PREFLIGHT_PASS local_checksum=valid encrypted_upload=not_started' "$scratch/out"
expect_failure retrieval_invalid_archive ./infra/retrieve-offsite-apartment-postgres.sh '../bad.dump'
expect_failure retrieval_missing_configuration env -u APARTMENT_OFFSITE_REMOTE -u APARTMENT_OFFSITE_AGE_IDENTITY ./infra/retrieve-offsite-apartment-postgres.sh 'apartment-20261104T011719Z-360623.dump'
identity="$scratch/test-only-identity"
printf '%s\n' 'NOT_A_REAL_KEY' > "$identity"
chmod 0644 "$identity"
expect_failure retrieval_insecure_identity env APARTMENT_OFFSITE_REMOTE="$safe_remote" APARTMENT_OFFSITE_AGE_IDENTITY="$identity" ./infra/retrieve-offsite-apartment-postgres.sh 'apartment-20261104T011719Z-360623.dump'
expect_failure retrieval_traversal_remote env APARTMENT_OFFSITE_REMOTE='mock:../escape' APARTMENT_OFFSITE_AGE_IDENTITY="$identity" ./infra/retrieve-offsite-apartment-postgres.sh 'apartment-20261104T011719Z-360623.dump'
echo 'OFFSITE_CONFIG_CHECK_TEST_PASS cases=8 uploads=0 live_restores=0'
