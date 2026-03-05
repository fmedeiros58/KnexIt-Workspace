#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

load_nvm_if_needed() {
  local node_path=""
  node_path="$(command -v node || true)"
  if [[ -n "$node_path" && "$node_path" != /mnt/c/* ]]; then
    return 0
  fi
  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$nvm_dir/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$nvm_dir/nvm.sh"
  fi
}

load_nvm_if_needed

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node Linux nao encontrado no WSL para benchmark." >&2
  exit 1
fi

exec node scripts/bench-rag-router.mjs
