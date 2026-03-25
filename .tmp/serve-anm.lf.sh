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

http_status() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    local status
    status="$(curl -sS -m 2 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || true)"
    echo "${status:-000}"
    return 0
  fi
  echo "000"
}

is_port_listening() {
  local port="$1"
  if ! command -v ss >/dev/null 2>&1; then
    return 1
  fi
  ss -ltn "sport = :${port}" 2>/dev/null | grep -qE "[:.]${port}[[:space:]]"
}

list_port_pids() {
  local port="$1"
  if ! command -v ss >/dev/null 2>&1; then
    return 0
  fi
  ss -ltnp "sport = :${port}" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u
}

kill_pids_gracefully() {
  local pids=("$@")
  if [[ "${#pids[@]}" -eq 0 ]]; then
    return 0
  fi
  log_warn "Encerrando processo(s) ANM na porta alvo: ${pids[*]}"
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      log_warn "PID $pid nao encerrou com SIGTERM; aplicando SIGKILL."
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
}

kill_port_owner_fallback() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    log_warn "Tentando encerrar dono da porta $port via fuser."
    fuser -k -n tcp "$port" >/dev/null 2>&1 || true
    return 0
  fi
  return 1
}

assert_port_released() {
  local port="$1"
  if is_port_listening "$port"; then
    log_error "A porta $port continua ocupada apos tentativa de restart."
    log_error "Causa comum: processo pertence a outro usuario do WSL."
    log_error "Use o mesmo usuario que iniciou o ANM, ou finalize com permissao elevada:"
    log_error "  sudo fuser -k -n tcp $port"
    return 1
  fi
  return 0
}

load_dotenv_file() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    local line="${raw_line%$'\r'}"
    # Strip UTF-8 BOM on first line when present.
    line="${line#$'\ufeff'}"

    # Ignore empty lines and comments.
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    # Accept KEY=VALUE pairs only.
    if [[ ! "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      continue
    fi

    local key="${BASH_REMATCH[1]}"
    local value="${BASH_REMATCH[2]}"

    # Trim leading spaces in value.
    value="${value#"${value%%[![:space:]]*}"}"

    # Remove surrounding quotes only when they wrap the whole value.
    if [[ "$value" =~ ^\"(.*)\"[[:space:]]*$ ]]; then
      value="${BASH_REMATCH[1]}"
    elif [[ "$value" =~ ^\'(.*)\'[[:space:]]*$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi

    export "$key=$value"
  done < "$env_file"
}

# Load local environment when available so ANM and frontend use the same LLM endpoints.
if [[ -f "$ROOT_DIR/.env.local" ]]; then
  load_dotenv_file "$ROOT_DIR/.env.local"
fi

NVME_BASE_PATH="${NVME_BASE_PATH:-}"
if [[ -n "$NVME_BASE_PATH" ]]; then
  if [[ ! -d "$NVME_BASE_PATH" ]]; then
    echo "NVME_BASE_PATH configurado, mas nao encontrado: $NVME_BASE_PATH"
    echo "Verifique montagem do volume NVMe/NVMe2 antes de subir o ANM backend."
    exit 1
  fi
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 nao encontrado no WSL. Instale Python 3 para subir o ANM backend."
  exit 1
fi

VENV_DIR="${ANM_VENV_DIR:-$ROOT_DIR/.anm-venv}"
if [ ! -x "$VENV_DIR/bin/python3" ]; then
  echo "Criando virtualenv do ANM em $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
fi

ANM_HOST="${ANM_HOST:-127.0.0.1}"
ANM_PORT="${ANM_PORT:-8100}"
ANM_REUSE_EXISTING="${ANM_REUSE_EXISTING:-1}"
ANM_FORCE_RESTART="${ANM_FORCE_RESTART:-0}"
ANM_KILL_PORT_OWNER="${ANM_KILL_PORT_OWNER:-1}"
ANM_CHECKPOINT_DIR="${ANM_CHECKPOINT_DIR:-$ROOT_DIR/anm_backend/data/checkpoints}"
if [[ "$ANM_CHECKPOINT_DIR" != /* ]]; then
  ANM_CHECKPOINT_DIR="$ROOT_DIR/$ANM_CHECKPOINT_DIR"
fi

if ! mkdir -p "$ANM_CHECKPOINT_DIR"; then
  echo "Falha ao criar ANM_CHECKPOINT_DIR: $ANM_CHECKPOINT_DIR"
  exit 1
fi

probe_file="$ANM_CHECKPOINT_DIR/.anm-rw-probe.$$"
if ! printf "ok" > "$probe_file" 2>/dev/null || ! cat "$probe_file" >/dev/null 2>&1; then
  echo "Sem permissao de leitura/escrita em ANM_CHECKPOINT_DIR: $ANM_CHECKPOINT_DIR"
  rm -f "$probe_file" 2>/dev/null || true
  exit 1
fi
rm -f "$probe_file" 2>/dev/null || true

PYTHON_BIN="$VENV_DIR/bin/python3"

if ! "$PYTHON_BIN" -c "import uvicorn, fastapi, pydantic" >/dev/null 2>&1; then
  echo "Instalando dependencias do ANM no virtualenv..."
  "$PYTHON_BIN" -m pip install --upgrade pip
  "$PYTHON_BIN" -m pip install -r anm_backend/requirements.txt
fi

ENGINE_BASE_URL="${ANM_ENGINE_BASE_URL:-${LOCAL_LLM_BASE_URL:-${LLM_BASE_URL:-${VLLM_BASE_URL:-http://127.0.0.1:8000/v1}}}}"
ENGINE_BASE_URL="${ENGINE_BASE_URL%/}"
ENGINE_REQUIRE_ON_START="${ANM_REQUIRE_ENGINE_ON_START:-1}"
ENGINE_HEALTH_URL="$ENGINE_BASE_URL/models"

probe_engine() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 4 "$ENGINE_HEALTH_URL" >/dev/null 2>&1
    return $?
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -q -T 4 -O - "$ENGINE_HEALTH_URL" >/dev/null 2>&1
    return $?
  fi
  return 2
}

if ! probe_engine; then
  if [[ "$ENGINE_REQUIRE_ON_START" == "1" || "$ENGINE_REQUIRE_ON_START" == "true" || "$ENGINE_REQUIRE_ON_START" == "TRUE" ]]; then
    log_error "LLM indisponivel em $ENGINE_HEALTH_URL"
    log_error "Suba o motor antes do ANM (ex.: npm run serve:vllm:wsl:restart)."
    exit 1
  fi
  log_warn "LLM indisponivel em $ENGINE_HEALTH_URL. O ANM subira, mas /chat pode falhar ate o motor ficar online."
fi

probe_host="127.0.0.1"
if [[ "$ANM_HOST" != "0.0.0.0" && "$ANM_HOST" != "::" ]]; then
  probe_host="$ANM_HOST"
fi
probe_url="http://${probe_host}:${ANM_PORT}/healthz"

anm_port_pids=()
while IFS= read -r pid; do
  if [[ -n "$pid" ]]; then
    anm_port_pids+=("$pid")
  fi
done < <(list_port_pids "$ANM_PORT")

current_status="$(http_status "$probe_url")"
port_busy=false
if is_port_listening "$ANM_PORT"; then
  port_busy=true
fi

if [[ "$current_status" == "200" ]]; then
  if as_bool_true "$ANM_FORCE_RESTART"; then
    if as_bool_true "$ANM_KILL_PORT_OWNER"; then
      if [[ "${#anm_port_pids[@]}" -gt 0 ]]; then
        kill_pids_gracefully "${anm_port_pids[@]}"
      else
        kill_port_owner_fallback "$ANM_PORT" || true
      fi
      sleep 1
      assert_port_released "$ANM_PORT" || exit 1
    else
      log_error "Porta $ANM_PORT ocupada por ANM saudavel e ANM_FORCE_RESTART=1 sem permissao de kill."
      exit 1
    fi
  elif as_bool_true "$ANM_REUSE_EXISTING"; then
    if [[ "${#anm_port_pids[@]}" -gt 0 ]]; then
      log_info "ANM ja esta ativo em http://${probe_host}:${ANM_PORT} (PID(s): ${anm_port_pids[*]}). Reutilizando instancia."
    else
      log_info "ANM ja esta ativo em http://${probe_host}:${ANM_PORT} (PID nao visivel para este usuario). Reutilizando instancia."
    fi
    exit 0
  else
    log_error "Porta $ANM_PORT ja esta ocupada por ANM saudavel. Use ANM_REUSE_EXISTING=1 ou ANM_FORCE_RESTART=1."
    exit 1
  fi
elif [[ "$port_busy" == true ]]; then
  if as_bool_true "$ANM_KILL_PORT_OWNER"; then
    log_warn "Porta $ANM_PORT ocupada com endpoint nao saudavel (status=$current_status). Reiniciando processo dono da porta."
    if [[ "${#anm_port_pids[@]}" -gt 0 ]]; then
      kill_pids_gracefully "${anm_port_pids[@]}"
    else
      kill_port_owner_fallback "$ANM_PORT" || {
        log_error "Nao foi possivel identificar dono da porta $ANM_PORT para kill automatico."
        exit 1
      }
    fi
    sleep 1
    assert_port_released "$ANM_PORT" || exit 1
  else
    log_error "Porta $ANM_PORT ocupada e endpoint nao saudavel (status=$current_status). Defina ANM_KILL_PORT_OWNER=1."
    exit 1
  fi
fi

# Guard final para evitar loop de bind quando a porta volta a ser ocupada
# entre a fase de verificacao e o exec do uvicorn.
if is_port_listening "$ANM_PORT"; then
  log_error "Porta $ANM_PORT ainda ocupada imediatamente antes do boot do ANM."
  log_error "Nao sera iniciado novo processo para evitar erro recorrente de bind."
  log_error "Use o mesmo usuario que iniciou a instancia existente ou encerre o dono da porta com sudo."
  exit 1
fi

exec "$PYTHON_BIN" -m uvicorn anm_backend.main:app --host "$ANM_HOST" --port "$ANM_PORT"
