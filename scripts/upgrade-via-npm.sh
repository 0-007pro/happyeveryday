#!/bin/bash

# qqbot 通过 openclaw 原生插件指令升级（公开副本）

set -eo pipefail

if [ -z "$_UPGRADE_ISOLATED" ] && [ -f "$0" ] && command -v setsid &>/dev/null; then
    export _UPGRADE_ISOLATED=1
    exec setsid "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd)" || SCRIPT_DIR=""
PROJECT_DIR=""
[ -n "$SCRIPT_DIR" ] && PROJECT_DIR="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)" || true

cd "$HOME" 2>/dev/null || cd / 2>/dev/null || true

ensure_valid_cwd() {
    stat . &>/dev/null 2>&1 || cd "$HOME" 2>/dev/null || cd / 2>/dev/null || true
}

read_pkg_version() {
    node -e "try{process.stdout.write(JSON.parse(require('fs').readFileSync('$1','utf8')).version||'')}catch{}" 2>/dev/null || true
}

version_gte() {
    [ "$(printf '%s\n' "$1" "$2" | sort -V | head -1)" = "$2" ]
}

for _p in /usr/local/bin /usr/local/sbin /usr/bin /usr/sbin /bin /sbin; do
    case ":$PATH:" in *":$_p:"*) ;; *) [ -d "$_p" ] && export PATH="$PATH:$_p" ;; esac
done
[ -z "$npm_config_registry" ] && export npm_config_registry="https://registry.npmjs.org"

NPM_REGISTRIES="https://registry.npmjs.org/ https://mirrors.cloud.tencent.com/npm/"

echo "qqbot public upgrade helper"
echo "Project dir: $PROJECT_DIR"
