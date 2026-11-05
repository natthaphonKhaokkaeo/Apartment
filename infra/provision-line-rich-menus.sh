#!/usr/bin/env bash
# Provision Apartment rich menu templates through the configured LINE Messaging API.
set -Eeuo pipefail
(( EUID == 0 )) || { echo ROOT_REQUIRED >&2; exit 2; }
project=apartment-dokploy-dev-ajcnbm
api="$project-api-1"
[[ "$(docker inspect "$api" --format '{{ index .Config.Labels "com.docker.compose.project" }}')" == "$project" ]] || { echo APARTMENT_DEV_API_REQUIRED >&2; exit 2; }
docker exec "$api" sh -lc 'cd /workspace/apps/api && corepack pnpm exec tsx src/scripts/provision-line-rich-menus.ts'
