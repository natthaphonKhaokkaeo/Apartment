#!/usr/bin/env bash
# DEV-only upgrade + backup recovery. Never targets the live DB for SQL writes.
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")/.."
backup_dir=/root/backups/apartment-postgres
# Derive the latest additive table marker and journal plan from repository metadata.
read -r target marker < <(python3 - <<'PY'
import json,re
from pathlib import Path
entry=json.loads(Path('apps/api/drizzle/meta/_journal.json').read_text())['entries'][-1]
content=Path('apps/api/drizzle',entry['tag']+'.sql').read_text()
m=re.search(r'CREATE TABLE "([a-z_]+)"',content)
if not m: raise SystemExit('Latest migration has no additive table marker; review rehearsal before running')
print(entry['tag'],m.group(1))
PY
)
[[ "$marker" =~ ^[a-z_]+$ && "$target" =~ ^[0-9]{4}_[a-z_]+$ ]]
archive=
while IFS= read -r candidate; do
 [[ "$candidate" =~ ^apartment-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ]] || continue
 (cd "$backup_dir" && sha256sum -c --status "$candidate.sha256") || continue
 manifest="$(docker exec -i apartment-dev-postgres-1 pg_restore -l < "$backup_dir/$candidate")"
 if ! grep -q "TABLE public $marker " <<< "$manifest"; then archive="$candidate"; break; fi
done < <(find "$backup_dir" -maxdepth 1 -type f -name 'apartment-*.dump' -printf '%f\n' | sort -r)
[[ -n "$archive" ]] || { echo 'BLOCKED: no verified pre-target backup retained'; exit 2; }
name="apartment-recovery-drill-$$"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --memory=768m --cpus=0.75 --name "$name" --network none --tmpfs /var/lib/postgresql/data:rw,size=512m -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
ready=false
for _ in $(seq 1 40); do
 if docker logs "$name" 2>&1 | grep -q 'PostgreSQL init process complete' && docker exec "$name" pg_isready -U postgres -d postgres >/dev/null 2>&1; then ready=true; break; fi
 sleep 1
done
[[ "$ready" == true ]]
query(){ docker exec "$name" psql -U postgres -d rehearsal -X -At -v ON_ERROR_STOP=1 -c "$1"; }
restore(){
 docker exec "$name" createdb -U postgres rehearsal
 docker exec -i "$name" pg_restore -U postgres -d rehearsal --no-owner --no-acl --exit-on-error < "$backup_dir/$archive"
}
restore
tables="$(query "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")"
fingerprint(){
 while IFS= read -r table; do
  [[ "$table" =~ ^[a-z_]+$ ]] || return 2
  query "SELECT '$table:' || count(*)::text || ':' || md5(coalesce(string_agg(row_to_json(t)::text, ',' ORDER BY id::text),'')) FROM public.$table t"
 done <<< "$tables"
}
original="$(fingerprint)"
schema_original="$(query "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
max_when="$(query 'SELECT coalesce(max(created_at),0) FROM drizzle.__drizzle_migrations')"
query "INSERT INTO public.organizations(id,name) VALUES(gen_random_uuid(),'P0 ephemeral migration sentinel')" >/dev/null
before="$(fingerprint)"
applied=0
while read -r when tag; do
 if (( when > max_when )); then
  docker exec -i "$name" psql -U postgres -d rehearsal -X -v ON_ERROR_STOP=1 --single-transaction >/dev/null < "apps/api/drizzle/$tag.sql"
  applied=$((applied+1))
 fi
done < <(python3 - <<'PY'
import json
for x in json.load(open('apps/api/drizzle/meta/_journal.json'))['entries']: print(x['when'],x['tag'])
PY
)
(( applied > 0 ))
[[ "$(query "SELECT to_regclass('public.$marker') IS NOT NULL")" == t ]]
[[ "$(query "SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='deposit_entries_immutable')")" == t ]]
[[ "$before" == "$(fingerprint)" ]]
docker exec "$name" dropdb -U postgres rehearsal
restore
[[ "$original" == "$(fingerprint)" ]]
[[ "$(query "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")" == "$schema_original" ]]
[[ "$(query "SELECT count(*) FROM public.organizations WHERE name='P0 ephemeral migration sentinel'")" == 0 ]]
printf 'MIGRATION_ROLLBACK_DRILL_PASS target=%s applied=%s original_table_fingerprints=%s restore=original network=none\n' "$target" "$applied" "$(wc -l <<< "$tables")"
