#!/usr/bin/env bash
# Existing Apartment Dokploy Compose only. Never restores/drops the live DB.
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")/.."
(( EUID == 0 )) || { echo ROOT_REQUIRED >&2; exit 2; }
project=apartment-dokploy-dev-ajcnbm
api="$project-api-1"; web="$project-web-1"; observer="$project-line-observer-1"
sha="$(git rev-parse HEAD)"; short="$(git rev-parse --short=12 HEAD)"
compose(){ docker compose -p "$project" -f docker-compose.dokploy.yml "$@"; }
[[ "$(docker inspect "$api" --format '{{ index .Config.Labels "com.docker.compose.project" }}')" == "$project" ]]
for image in "apartment-api:dev-$short" "apartment-web:dev-$short"; do
 [[ "$(docker image inspect "$image" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')" == "$sha" ]] || { echo IMAGE_SOURCE_MISMATCH >&2; exit 2; }
done
python3 - <<'PY'
from pathlib import Path
env={}
for line in Path('/etc/dokploy/runtime-env/apartment-api.env').read_text().splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  k,v=line.split('=',1);env[k.strip()]=v.strip().strip('"').strip("'")
mode=env.get('LINE_OUTBOUND_MODE','disabled')
assert mode in ('disabled','live'),'Unsupported LINE outbound mode'
if mode=='live':
 assert env.get('LINE_WORKER_MODE')=='live','Live LINE requires worker mode live'
 assert env.get('LINE_WORKER_APPROVED')=='true','Live LINE requires explicit approval flag'
 assert env.get('LINE_AUTO_DUE_REMINDERS')=='true','Live LINE due reminders must be explicitly enabled'
 assert all(env.get(k) for k in ('LINE_MESSAGING_CHANNEL_SECRET','LINE_MESSAGING_CHANNEL_ACCESS_TOKEN','LINE_OA_BOT_USER_ID')),'Live LINE credentials are incomplete'
else:
 assert env.get('LINE_WORKER_MODE','observe')=='observe' and env.get('LINE_WORKER_APPROVED','false')=='false','Disabled LINE worker must remain observe-only'

assert env.get('WEB_ORIGIN')=='https://apartme.makemarket.space','Unexpected DEV origin'
assert env.get('COOKIE_SECURE')=='true','HTTPS cookies required'
print('DEV_RUNTIME_LINE_LIVE_PREFLIGHT_PASS' if mode=='live' else 'DEV_RUNTIME_SAFE_PREFLIGHT_PASS')
PY
old_api="$(docker inspect "$api" --format '{{.Image}}')"
old_web="$(docker inspect "$web" --format '{{.Image}}')"
old_observer="$(docker inspect "$observer" --format '{{.Image}}')"
if [[ "$old_api" != "$old_observer" ]]; then
 observer_health="$(docker inspect "$observer" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}')"
 [[ "$observer_health" == healthy ]] || { echo DIFFERENT_OBSERVER_BASELINE_NOT_HEALTHY >&2; exit 2; }
 pending="$(docker exec apartment-dev-postgres-1 psql -U apartment -d apartment -X -Atc "SELECT count(*) FROM public.line_outbox WHERE status IN ('QUEUED','RETRY','SENDING')")"
 [[ "$pending" == 0 ]] || { echo DIFFERENT_OBSERVER_BASELINE_HAS_PENDING_NOTIFICATIONS >&2; exit 2; }
 echo DEV_DIFFERENT_OBSERVER_BASELINE_REVIEWED healthy=true pending_notifications=0 rollback_recreates_from_api_image=true
fi
db_started="$(docker inspect apartment-dev-postgres-1 --format '{{.State.StartedAt}}')"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 .qa-output
printf 'commit=%s\nold_api=%s\nold_web=%s\ndb_started=%s\n' "$sha" "$old_api" "$old_web" "$db_started" > ".qa-output/rollback-$stamp.txt"
docker image tag "$old_api" "apartment-api:rollback-$stamp"
docker image tag "$old_web" "apartment-web:rollback-$stamp"
bash infra/backup-apartment-postgres.sh backup
bash infra/local-archive-apartment-postgres.sh archive
bash infra/local-archive-apartment-postgres.sh restore-test
changed=false
rollback(){
 local status="$1"
 trap - ERR
 if [[ "$changed" == true ]]; then
  echo 'DEV_ROLLBACK_START application_images_only=true database_restore=false' >&2
  docker image tag "$old_api" apartment-api:dokploy-dev
  docker image tag "$old_web" apartment-web:dokploy-dev
  compose up -d --no-deps --no-build api line-observer web || true
 fi
 echo "DEV_DEPLOY_FAILED exit=$status inspect_logs_before_retry=true" >&2
 exit "$status"
}
trap 'rollback $?' ERR
healthy(){
 local container="$1"
 for _ in $(seq 1 65); do
  state="$(docker inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}')"
  [[ "$state" != unhealthy ]] || { echo "UNHEALTHY $container" >&2; return 1; }
  if [[ "$state" == healthy ]]; then return 0; fi
  sleep 2
 done
 echo "HEALTH_TIMEOUT $container" >&2; return 1
}
changed=true
docker image tag "apartment-api:dev-$short" apartment-api:dokploy-dev
docker image tag "apartment-web:dev-$short" apartment-web:dokploy-dev
compose up -d --no-deps --no-build api
healthy "$api"
compose up -d --no-deps --no-build line-observer
compose up -d --no-deps --no-build web
healthy "$web"
healthy "$observer"
[[ "$(docker inspect apartment-dev-postgres-1 --format '{{.State.StartedAt}}')" == "$db_started" ]]
python3 - <<'PY'
import json,subprocess
from pathlib import Path
journal=json.loads(Path('apps/api/drizzle/meta/_journal.json').read_text())['entries']
actual=subprocess.check_output(['docker','exec','apartment-dev-postgres-1','psql','-U','apartment','-d','apartment','-X','-Atc','SELECT count(*)::text || \'|\' || max(created_at)::text FROM drizzle.__drizzle_migrations'],text=True).strip()
assert actual==str(len(journal))+'|'+str(journal[-1]['when']),'Migration journal mismatch'
for name in ['apartment-dokploy-dev-ajcnbm-api-1','apartment-dokploy-dev-ajcnbm-line-observer-1']:
 data=json.loads(subprocess.check_output(['docker','inspect',name],text=True))[0]
 env=dict(x.split('=',1) for x in data['Config']['Env'] if '=' in x)
 if 'observer' in name:
  assert env.get('LINE_OUTBOUND_MODE')=='live' and env.get('LINE_WORKER_MODE')=='live'
  assert env.get('LINE_WORKER_APPROVED')=='true' and env.get('LINE_AUTO_DUE_REMINDERS')=='true'
 else:
  assert env.get('LINE_OUTBOUND_MODE')=='live'
print('DEV_MIGRATIONS_AND_LINE_LIVE_PASS')
PY
bash infra/smoke-apartment-public-dev.sh
trap - ERR
printf 'DEV_DEPLOY_PASS commit=%s project=%s postgres_restarted=false rollback_tag=%s\n' "$sha" "$project" "$stamp"
