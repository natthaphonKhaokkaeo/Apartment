#!/usr/bin/env bash
# No network or production R2 secrets required.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
(( EUID == 0 )) || { echo 'SKIP: root-only'; exit 0; }
script=./infra/setup-apartment-r2.sh
[[ ! -f /etc/apartment/offsite.env ]] || { echo 'SKIP: machine already configured for R2'; exit 0; }
if "$script" status >/dev/null 2>&1; then echo 'ERROR: missing R2 config was accepted' >&2; exit 1; fi
if "$script" configure </dev/null >/dev/null 2>&1; then echo 'ERROR: noninteractive secret provisioning was accepted' >&2; exit 1; fi
if "$script" remote-check >/dev/null 2>&1; then echo 'ERROR: unconfigured remote was accepted' >&2; exit 1; fi
echo 'R2_SETUP_GUARD_PASS incomplete_config=blocked noninteractive_secrets=blocked missing_remote=blocked'
