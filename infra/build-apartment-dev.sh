#!/usr/bin/env bash
# Build immutable DEV images only from committed source. Does not deploy containers.
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")/.."
git diff --quiet HEAD -- apps packages infra/Dockerfile docker-compose.dokploy.yml package.json pnpm-lock.yaml pnpm-workspace.yaml .dockerignore || { echo UNCOMMITTED_APPLICATION_SOURCE >&2; exit 2; }
[[ -z "$(git ls-files --others --exclude-standard apps packages)" ]] || { echo UNTRACKED_APPLICATION_SOURCE >&2; exit 2; }
sha="$(git rev-parse HEAD)"
short="$(git rev-parse --short=12 HEAD)"
free_kb="$(df --output=avail . | tail -1 | tr -d ' ')"
(( free_kb >= 4*1024*1024 )) || { echo INSUFFICIENT_BUILD_DISK >&2; exit 2; }
build_dir="$(mktemp -d /root/Projects/.apartment-build-XXXXXXXX)"
cleanup(){ rm -rf -- "$build_dir"; }
trap cleanup EXIT
git archive HEAD | tar -x -C "$build_dir"
# LIFF ID is public client configuration; no runtime database/provider secrets enter the build.
liff_id="$(python3 - <<'PY'
from pathlib import Path
for line in Path('/etc/dokploy/runtime-env/apartment-api.env').read_text().splitlines():
 if line.startswith('VITE_LIFF_ID='):
  print(line.split('=',1)[1].strip().strip('"').strip("'"))
  break
PY
)"
[[ -n "$liff_id" ]] || { echo MISSING_LIFF_BUILD_CONFIGURATION >&2; exit 2; }
docker build --build-arg "VITE_LIFF_ID=$liff_id" --label "org.opencontainers.image.revision=$sha" --target api -f "$build_dir/infra/Dockerfile" -t "apartment-api:dev-$short" "$build_dir"
docker build --build-arg "VITE_LIFF_ID=$liff_id" --label "org.opencontainers.image.revision=$sha" --target web -f "$build_dir/infra/Dockerfile" -t "apartment-web:dev-$short" "$build_dir"
printf 'DEV_IMAGES_BUILT commit=%s api=apartment-api:dev-%s web=apartment-web:dev-%s\n' "$sha" "$short" "$short"
