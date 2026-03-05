#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log_info() {
  echo "[INFO] $*"
}

log_warn() {
  echo "[WARN] $*"
}

log_error() {
  echo "[ERROR] $*" >&2
}

as_bool_true() {
  local raw="${1:-}"
  raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$raw" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

load_dotenv_file() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    local line="${raw_line%$'\r'}"
    line="${line#$'\ufeff'}"
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ ! "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      continue
    fi
    local key="${BASH_REMATCH[1]}"
    local value="${BASH_REMATCH[2]}"
    value="${value#"${value%%[![:space:]]*}"}"
    if [[ "$value" =~ ^\"(.*)\"[[:space:]]*$ ]]; then
      value="${BASH_REMATCH[1]}"
    elif [[ "$value" =~ ^\'(.*)\'[[:space:]]*$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
    export "$key=$value"
  done < "$env_file"
}

is_windows_node_path() {
  local value="${1:-}"
  [[ "$value" == /mnt/c/* || "$value" == *"Program Files/nodejs"* ]]
}

ensure_linux_node() {
  local node_path=""
  node_path="$(command -v node || true)"
  if [[ -n "$node_path" ]] && ! is_windows_node_path "$node_path"; then
    return 0
  fi

  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$nvm_dir/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$nvm_dir/nvm.sh"
    node_path="$(command -v node || true)"
    if [[ -n "$node_path" ]] && ! is_windows_node_path "$node_path"; then
      return 0
    fi
  fi

  log_error "Node Linux nao encontrado no WSL (apenas Node do Windows detectado)."
  log_error "Instale via nvm no WSL e tente novamente:"
  log_error "  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
  log_error "  export NVM_DIR=\"\$HOME/.nvm\" && . \"\$NVM_DIR/nvm.sh\""
  log_error "  nvm install --lts && nvm alias default lts/*"
  exit 1
}

http_status() {
  local url="$1"
  local status
  status="$(curl -sS -m 2 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || true)"
  echo "${status:-000}"
}

list_port_pids() {
  local port="$1"
  ss -ltnp "sport = :${port}" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u
}

kill_pids_gracefully() {
  local pids=("$@")
  [[ "${#pids[@]}" -eq 0 ]] && return 0
  log_warn "Encerrando processo(s) Next na porta alvo: ${pids[*]}"
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
}

if [[ -f "$ROOT_DIR/.env.local" ]]; then
  load_dotenv_file "$ROOT_DIR/.env.local"
fi

ensure_linux_node

NEXT_HOST="${NEXT_HOST:-127.0.0.1}"
NEXT_PORT="${NEXT_PORT:-3000}"
NEXT_REUSE_EXISTING="${NEXT_REUSE_EXISTING:-1}"
NEXT_FORCE_RESTART="${NEXT_FORCE_RESTART:-0}"
NEXT_KILL_PORT_OWNER="${NEXT_KILL_PORT_OWNER:-1}"

probe_url="http://127.0.0.1:${NEXT_PORT}"
pids=()
while IFS= read -r pid; do
  [[ -n "$pid" ]] && pids+=("$pid")
done < <(list_port_pids "$NEXT_PORT")

if [[ "${#pids[@]}" -gt 0 ]]; then
  status="$(http_status "$probe_url")"
  if [[ "$status" == "200" || "$status" == "307" || "$status" == "308" ]]; then
    if as_bool_true "$NEXT_FORCE_RESTART"; then
      if as_bool_true "$NEXT_KILL_PORT_OWNER"; then
        kill_pids_gracefully "${pids[@]}"
      else
        log_error "Porta $NEXT_PORT ocupada por Next saudavel e NEXT_FORCE_RESTART=1 sem kill."
        exit 1
      fi
    elif as_bool_true "$NEXT_REUSE_EXISTING"; then
      log_info "Next ja ativo em $probe_url (PID(s): ${pids[*]}). Reutilizando instancia."
      exit 0
    else
      log_error "Porta $NEXT_PORT ocupada por Next saudavel."
      exit 1
    fi
  elif as_bool_true "$NEXT_KILL_PORT_OWNER"; then
    kill_pids_gracefully "${pids[@]}"
  else
    log_error "Porta $NEXT_PORT ocupada e NEXT_KILL_PORT_OWNER=0."
    exit 1
  fi
fi

log_info "Subindo Next dev em http://${NEXT_HOST}:${NEXT_PORT} (WSL host-only stack)."
exec npm run dev -- -H "$NEXT_HOST" -p "$NEXT_PORT"
