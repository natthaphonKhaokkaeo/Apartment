#!/usr/bin/env bash
# Integration of the offsite upload pipeline with fake local age/rclone.
# No network, no real keys, no writes to the Apartment DB or remote.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
(( EUID == 0 )) || { echo 'SKIP: requires root to read local DEV backups'; exit 0; }
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
mkdir -p "$scratch/bin" "$scratch/remote"
cat > "$scratch/bin/age" <<'FAKE_AGE'
#!/usr/bin/env bash
set -euo pipefail
output=''
input=''
while (( $# )); do
 case "$1" in
  -r) shift 2 ;;
  -o) output="$2"; shift 2 ;;
  --) shift; input="$1"; shift ;;
  *) exit 91 ;;
 esac
done
[[ -n "$output" && -f "$input" ]] || exit 92
[[ "${FAKE_AGE_FAIL:-0}" == 0 ]] || exit 97
{ printf 'ENCRYPTED_TEST_ONLY\n'; cat -- "$input"; } > "$output"
FAKE_AGE
cat > "$scratch/bin/rclone" <<'FAKE_RCLONE'
#!/usr/bin/env bash
set -euo pipefail
cmd="$1"; shift
case "$cmd" in
 copyto)
  [[ "$1" == '--immutable' ]] || exit 93
  [[ "${FAKE_RCLONE_UPLOAD_FAIL:-0}" == 0 ]] || exit 98
  shift
  src="$1"; shift; dest="$1"
  path="$FAKE_REMOTE_DIR/$(basename "$dest")"
  [[ ! -e "$path" ]] || exit 94
  cp -- "$src" "$path"
  ;;
 cat)
  path="$FAKE_REMOTE_DIR/$(basename "$1")"
  if [[ "$FAKE_REMOTE_CORRUPT" == 1 ]]; then
   printf 'CORRUPTED_TEST_DATA\n'
  else
   cat -- "$path"
  fi
  ;;
 *) exit 95 ;;
esac
FAKE_RCLONE
chmod 700 "$scratch"/bin/*
export PATH="$scratch/bin:$PATH"
export FAKE_REMOTE_DIR="$scratch/remote"
export FAKE_REMOTE_CORRUPT=0
export APARTMENT_OFFSITE_AGE_RECIPIENT="age1$(printf '%058d' 0 | tr '0' q)"
export APARTMENT_OFFSITE_REMOTE="mock:apartment/dedicated"
script=./infra/offsite-apartment-postgres.sh
"$script" upload > "$scratch/ok.log"
grep -q OFFSITE_UPLOAD_PASS "$scratch/ok.log"
test "$(find "$scratch/remote" -type f | wc -l)" -eq 1
remote_file="$(find "$scratch/remote" -type f | head -1)"
[[ "$(head -1 "$remote_file")" == ENCRYPTED_TEST_ONLY ]]
if "$script" upload > "$scratch/duplicate.log" 2>&1; then
 echo 'ERROR: immutable duplicate unexpectedly passed' >&2
 exit 1
fi
rm -f "$remote_file"
export FAKE_REMOTE_CORRUPT=1
if "$script" upload > "$scratch/corrupt.log" 2>&1; then
 echo 'ERROR: corrupted remote ciphertext unexpectedly passed' >&2
 exit 1
fi
grep -q 'remote ciphertext verification failed' "$scratch/corrupt.log"
rm -f "$remote_file"
export FAKE_AGE_FAIL=1
if "$script" upload > "$scratch/encrypt-fail.log" 2>&1; then
 echo 'ERROR: simulated age failure unexpectedly passed' >&2
 exit 1
fi
[[ ! -e "$remote_file" ]] || { echo 'ERROR: unencrypted data uploaded' >&2; exit 1; }
export FAKE_AGE_FAIL=0
export FAKE_RCLONE_UPLOAD_FAIL=1
if "$script" upload > "$scratch/upload-fail.log" 2>&1; then
 echo 'ERROR: simulated upload failure unexpectedly passed' >&2
 exit 1
fi
[[ ! -e "$remote_file" ]] || { echo 'ERROR: failed upload created remote object' >&2; exit 1; }
echo 'OFFSITE_UPLOAD_MOCK_PASS encryption_first=true immutable=true corruption_rejected=true encryption_failure_closed=true upload_failure_closed=true remote_network=none'
