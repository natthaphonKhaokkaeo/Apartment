#!/usr/bin/env bash
# Apartment DEV public ingress only; non-mutating and no authenticated requests.
set -euo pipefail

base="${APARTMENT_PUBLIC_ORIGIN:-https://apartme.makemarket.space}"
[[ "$base" == https://* && "$base" != *'?'* && "$base" != *'#'* ]] || {
  echo 'INVALID_HTTPS_ORIGIN' >&2
  exit 2
}
base="${base%/}"

check_status() {
  local label="$1" expected="$2" method="$3" path="$4"
  local actual
  actual="$(curl --proto '=https' --tlsv1.2 --silent --show-error     --max-time 12 --output /dev/null --write-out '%{http_code}'     --request "$method" "$base$path")"
  if [[ "$actual" != "$expected" ]]; then
    echo "$label FAIL expected=$expected actual=$actual" >&2
    return 1
  fi
  echo "$label PASS status=$actual"
}
check_status WEB_PUBLIC 200 GET /
check_status API_HEALTH_PUBLIC 200 GET /healthz
check_status API_READY_PUBLIC 200 GET /readyz

# A missing signature must NEVER be accepted by the LINE Messaging API webhook.
# This is deliberately not a signed provider call and never enqueues any event.
webhook_status="$(curl --proto '=https' --tlsv1.2 --silent --show-error   --max-time 12 --output /dev/null --write-out '%{http_code}'   --header 'content-type: application/json'   --data '{"events":[]}'   "$base/v1/line/oa/webhook")"
[[ "$webhook_status" == 401 ]] || {
  echo "WEBHOOK_UNSIGNED_DENIAL FAIL expected=401 actual=$webhook_status" >&2
  exit 1
}
echo 'WEBHOOK_UNSIGNED_DENIAL PASS status=401'
echo 'PUBLIC_DEV_SMOKE_PASS certificates=verified no_live_LINE_calls=true'
