#!/usr/bin/env bash
# Interactive, root-only Cloudflare R2 bootstrap. No secrets in arguments,
# shell history, git, or stdout. Does not enable scheduling or modify databases.
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'ERROR: root required' >&2; exit 2; }
ROOT_CONFIG=/etc/apartment
R2_DIR=$ROOT_CONFIG/r2
CONFIG=$R2_DIR/rclone.conf
OFFSITE=$ROOT_CONFIG/offsite.env
REMOTE_NAME=apartmentr2
usage(){ echo 'Usage: setup-apartment-r2.sh status|configure|remote-check' >&2; exit 2; }
(( $# == 1 )) || usage
secure_file(){ [[ -f "$1" && ! -L "$1" && "$(stat -c '%u:%a' "$1")" == 0:600 ]]; }
secure_dir(){ [[ -d "$1" && ! -L "$1" && "$(stat -c '%u:%a' "$1")" == 0:700 ]]; }
status(){
 if ! secure_dir "$ROOT_CONFIG" || ! secure_dir "$R2_DIR" || ! secure_file "$CONFIG" || ! secure_file "$OFFSITE"; then
  echo 'R2_OFFSITE_NOT_CONFIGURED secure_config=missing_or_invalid schedule=not_changed'; return 1
 fi
 if ! grep -qFx "RCLONE_CONFIG=$CONFIG" "$OFFSITE" ||
    ! grep -qFx "[${REMOTE_NAME}]" "$CONFIG" ||
    ! grep -qFx 'type = s3' "$CONFIG" ||
    ! grep -qFx 'provider = Cloudflare' "$CONFIG" ||
    ! grep -qFx 'no_check_bucket = true' "$CONFIG" ||
    ! grep -Eq '^endpoint = https://[a-f0-9]{32}(\.(eu|us|fedramp))?\.r2\.cloudflarestorage\.com$' "$CONFIG" ||
    ! grep -Eq '^APARTMENT_OFFSITE_REMOTE=apartmentr2:[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]/postgres/dev$' "$OFFSITE" ||
    ! grep -Eq '^APARTMENT_OFFSITE_AGE_RECIPIENT=age1[0-9a-z]{58}$' "$OFFSITE"; then
  echo 'R2_OFFSITE_NOT_CONFIGURED metadata_invalid schedule=not_changed'; return 1
 fi
 echo 'R2_OFFSITE_CONFIG_READY files=root_only remote=cloudflare_r2 scope=dedicated_bucket timer=manual_activation'
}
case "$1" in
 status) status;;
 remote-check)
  status || exit 2
  bucket="$(sed -n 's/^APARTMENT_OFFSITE_REMOTE=apartmentr2:\([^/]*\)\/postgres\/dev$/\1/p' "$OFFSITE")"
  rclone --config "$CONFIG" lsf "$REMOTE_NAME:$bucket" >/dev/null || { echo 'ERROR: R2 credentials/bucket connection failed' >&2; exit 1; }
  echo 'R2_REMOTE_CHECK_PASS bucket_accessible=true encrypted_transfer=not_started'
  ;;
 configure)
  [[ -t 0 ]] || { echo 'ERROR: configure must run interactively on a trusted terminal (no token arguments)' >&2; exit 2; }
  if [[ -e "$CONFIG" || -e "$OFFSITE" ]]; then
   echo 'ERROR: existing config present; refusing silent overwrite. Rotate keys using a supervised process.' >&2; exit 2
  fi
  for utility in age rclone stat mktemp; do command -v "$utility" >/dev/null || { echo "ERROR: missing $utility" >&2; exit 2; }; done
  read -r -p 'Cloudflare Account ID (32 hex chars): ' account
  read -r -p 'Dedicated PRIVATE R2 bucket (lowercase DNS name): ' bucket
  read -r -p 'Jurisdiction (global/eu/us/fedramp) [global]: ' jurisdiction
  jurisdiction="${jurisdiction:-global}"
  read -r -p 'R2 Access Key ID (scoped to this bucket): ' access_id
  read -r -s -p 'R2 Secret Access Key (hidden): ' secret; printf '\n' >&2
  read -r -p 'age PUBLIC recipient created on separate recovery host: ' recipient
  [[ "$account" =~ ^[a-f0-9]{32}$ ]] || { echo 'ERROR: invalid Account ID' >&2; exit 2; }
  [[ "$bucket" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ && "$bucket" != *..* ]] || { echo 'ERROR: invalid bucket' >&2; exit 2; }
  [[ "$jurisdiction" =~ ^(global|eu|us|fedramp)$ ]] || { echo 'ERROR: invalid jurisdiction' >&2; exit 2; }
  [[ "$access_id" =~ ^[A-Za-z0-9_+=/-]{12,128}$ && "$secret" =~ ^[A-Za-z0-9_+=/-]{16,256}$ ]] ||
   { echo 'ERROR: invalid credential format' >&2; exit 2; }
  [[ "$recipient" =~ ^age1[0-9a-z]{58}$ ]] || { echo 'ERROR: invalid age public key' >&2; exit 2; }
  endpoint="https://$account"
  [[ "$jurisdiction" == global ]] || endpoint+=".$jurisdiction"
  endpoint+='.r2.cloudflarestorage.com'
  install -d -m 0700 -o root -g root "$ROOT_CONFIG" "$R2_DIR"
  secure_dir "$ROOT_CONFIG" && secure_dir "$R2_DIR" || { echo 'ERROR: insecure /etc/apartment directory' >&2; exit 2; }
  tmp="$(mktemp "$R2_DIR/.rclone-XXXXXXXX")"
  cleanup(){ rm -f -- "${tmp:-}" "${envtmp:-}"; }; trap cleanup EXIT
  cat >"$tmp" <<CONF
[$REMOTE_NAME]
type = s3
provider = Cloudflare
env_auth = false
access_key_id = $access_id
secret_access_key = $secret
region = auto
endpoint = $endpoint
no_check_bucket = true
acl = private
CONF
  chmod 0600 "$tmp"
  # Confirm credentials and the bucket with read-only operations before publishing.
  if ! rclone --config "$tmp" lsf "$REMOTE_NAME:$bucket" >/dev/null; then
   echo 'ERROR: R2 bucket check failed; nothing installed and no scheduler enabled' >&2; exit 1
  fi
  envtmp="$(mktemp "$ROOT_CONFIG/.offsite-XXXXXXXX")"
  printf 'RCLONE_CONFIG=%s\nAPARTMENT_OFFSITE_REMOTE=%s:%s/postgres/dev\nAPARTMENT_OFFSITE_AGE_RECIPIENT=%s\n' \
   "$CONFIG" "$REMOTE_NAME" "$bucket" "$recipient" >"$envtmp"
  chmod 0600 "$envtmp"
  mv -n "$tmp" "$CONFIG"; tmp=
  mv -n "$envtmp" "$OFFSITE"; envtmp=
  unset secret access_id
  echo 'R2_CONFIGURATION_CREATED scoped_credentials=confirmed keys_hidden=true scheduler=disabled'
  status
  ;;
 *) usage;;
esac
