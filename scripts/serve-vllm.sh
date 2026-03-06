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

resolve_first_cuda_device() {
  local visible="${CUDA_VISIBLE_DEVICES:-}"
  if [[ -z "$visible" ]]; then
    echo "0"
    return 0
  fi
  local first="${visible%%,*}"
  first="${first//[[:space:]]/}"
  if [[ "$first" =~ ^[0-9]+$ ]]; then
    echo "$first"
    return 0
  fi
  echo "0"
}

is_positive_int() {
  [[ "${1:-}" =~ ^[1-9][0-9]*$ ]]
}

model_ref_looks_local() {
  local ref="$1"
  if [[ "$ref" == /* || "$ref" == ./* || "$ref" == ../* || "$ref" == models/* || "$ref" == ~/* ]]; then
    return 0
  fi
  if [[ "$ref" == *\\* || "$ref" =~ ^[A-Za-z]:[/\\] ]]; then
    return 0
  fi
  return 1
}

expand_home_path() {
  local path="$1"
  if [[ "$path" == "~/"* ]]; then
    echo "$HOME/${path#~/}"
    return 0
  fi
  echo "$path"
}

http_status() {
  local url="$1"
  if ! command -v curl >/dev/null 2>&1; then
    echo "000"
    return 0
  fi
  local status
  status="$(curl -sS -m 2 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || true)"
  echo "${status:-000}"
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
  log_warn "Encerrando PID(s) na porta alvo: ${pids[*]}"
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

guard_gpu_memory() {
  local gpu_index="$1"
  local min_free_mb="$2"
  local require_nvidia_smi="$3"

  if ! command -v nvidia-smi >/dev/null 2>&1; then
    if as_bool_true "$require_nvidia_smi"; then
      log_error "nvidia-smi nao encontrado; nao foi possivel validar VRAM."
      exit 1
    fi
    log_warn "nvidia-smi indisponivel; pulando validacao de VRAM."
    return 0
  fi

  local raw
  raw="$(nvidia-smi --query-gpu=memory.free,memory.total --format=csv,noheader,nounits -i "$gpu_index" 2>/dev/null | head -n 1 || true)"
  if [[ -z "$raw" ]]; then
    log_warn "Nao foi possivel ler memoria da GPU index $gpu_index; pulando validacao de VRAM."
    return 0
  fi

  local free_mb total_mb
  free_mb="$(echo "$raw" | awk -F',' '{gsub(/[[:space:]]/,"",$1); print $1}')"
  total_mb="$(echo "$raw" | awk -F',' '{gsub(/[[:space:]]/,"",$2); print $2}')"

  if ! [[ "$free_mb" =~ ^[0-9]+$ ]]; then
    log_warn "Valor de VRAM livre inesperado: '$free_mb'; pulando validacao."
    return 0
  fi
  if ! [[ "$total_mb" =~ ^[0-9]+$ ]]; then
    total_mb=0
  fi

  log_info "GPU[$gpu_index] VRAM livre=${free_mb}MB total=${total_mb}MB (minimo exigido=${min_free_mb}MB)."
  if (( free_mb < min_free_mb )); then
    log_error "VRAM insuficiente para subir vLLM (livre=${free_mb}MB < minimo=${min_free_mb}MB)."
    log_error "Ajuste: encerre processo(s) de GPU, reduza VLLM_MAX_NUM_SEQS/VLLM_MAX_MODEL_LEN ou use VLLM_FORCE_RESTART=1."
    exit 1
  fi
}

VLLM_BIN="${VLLM_BIN:-}"
if [[ -z "$VLLM_BIN" ]]; then
  if command -v vllm >/dev/null 2>&1; then
    VLLM_BIN="vllm"
  elif [[ -x "$HOME/vllm-venv/bin/vllm" ]]; then
    VLLM_BIN="$HOME/vllm-venv/bin/vllm"
  fi
fi
if [[ -z "$VLLM_BIN" ]]; then
  log_error "Comando 'vllm' nao encontrado no ambiente atual."
  log_error "Instale o vLLM no WSL/Python env ou defina VLLM_BIN."
  exit 1
fi

VLLM_MODEL_PATH="${VLLM_MODEL_PATH:-${LOCAL_LLM_MODEL:-models/CModelosMistral-7B-Instruct-v0.2-AWQ}}"
VLLM_HOST="${VLLM_HOST:-127.0.0.1}"
VLLM_PORT="${VLLM_PORT:-8000}"
VLLM_SERVED_MODEL_NAME="${VLLM_SERVED_MODEL_NAME:-mistral-awq}"
VLLM_MAX_NUM_SEQS="${VLLM_MAX_NUM_SEQS:-2}"
VLLM_MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-4096}"
VLLM_GPU_MEMORY_UTILIZATION="${VLLM_GPU_MEMORY_UTILIZATION:-0.90}"
VLLM_TENSOR_PARALLEL_SIZE="${VLLM_TENSOR_PARALLEL_SIZE:-}"
VLLM_EXTRA_ARGS="${VLLM_EXTRA_ARGS:-}"
VLLM_REUSE_EXISTING="${VLLM_REUSE_EXISTING:-1}"
VLLM_FORCE_RESTART="${VLLM_FORCE_RESTART:-0}"
VLLM_KILL_PORT_OWNER="${VLLM_KILL_PORT_OWNER:-1}"
VLLM_REQUIRE_NVIDIA_SMI="${VLLM_REQUIRE_NVIDIA_SMI:-0}"
VLLM_GPU_INDEX="${VLLM_GPU_INDEX:-$(resolve_first_cuda_device)}"
VLLM_MIN_FREE_GPU_MB="${VLLM_MIN_FREE_GPU_MB:-2500}"

if [[ "$VLLM_HOST" == "0.0.0.0" || "$VLLM_HOST" == "::" ]]; then
  log_warn "VLLM_HOST=$VLLM_HOST expoe o motor fora do loopback. Prefira 127.0.0.1 para ambiente host-only."
fi

if model_ref_looks_local "$VLLM_MODEL_PATH"; then
  local_model_path="$(expand_home_path "$VLLM_MODEL_PATH")"
  if [[ ! -e "$local_model_path" ]]; then
    log_error "VLLM_MODEL_PATH parece local, mas nao existe: $local_model_path"
    log_error "Corrija o caminho do modelo antes de subir o vLLM."
    exit 1
  fi
fi

probe_host="127.0.0.1"
if [[ "$VLLM_HOST" != "0.0.0.0" && "$VLLM_HOST" != "::" ]]; then
  probe_host="$VLLM_HOST"
fi
probe_url="http://${probe_host}:${VLLM_PORT}/v1/models"

port_pids=()
while IFS= read -r pid; do
  if [[ -n "$pid" ]]; then
    port_pids+=("$pid")
  fi
done < <(list_port_pids "$VLLM_PORT")

current_status="$(http_status "$probe_url")"
if [[ "$current_status" == "200" ]]; then
  if as_bool_true "$VLLM_FORCE_RESTART"; then
    if [[ "${#port_pids[@]}" -gt 0 ]] && as_bool_true "$VLLM_KILL_PORT_OWNER"; then
      kill_pids_gracefully "${port_pids[@]}"
    else
      log_warn "vLLM saudavel detectado em http://${probe_host}:${VLLM_PORT}/v1, mas restart forcado nao e possivel sem PID visivel."
      log_warn "Reutilizando instancia existente para evitar indisponibilidade."
      exit 0
    fi
  elif as_bool_true "$VLLM_REUSE_EXISTING"; then
    if [[ "${#port_pids[@]}" -gt 0 ]]; then
      log_info "vLLM ja esta ativo em http://${probe_host}:${VLLM_PORT}/v1 (PID(s): ${port_pids[*]}). Reutilizando instancia."
    else
      log_info "vLLM ja esta ativo em http://${probe_host}:${VLLM_PORT}/v1 (PID nao visivel para este usuario). Reutilizando instancia."
    fi
    exit 0
  else
    log_error "Porta $VLLM_PORT ja esta ocupada por vLLM saudavel. Defina VLLM_REUSE_EXISTING=1 ou VLLM_FORCE_RESTART=1."
    exit 1
  fi
fi

if [[ "${#port_pids[@]}" -gt 0 ]]; then
  if as_bool_true "$VLLM_KILL_PORT_OWNER"; then
    log_warn "Porta $VLLM_PORT ocupada com endpoint nao saudavel (status=$current_status). Reiniciando dono(s) da porta."
    kill_pids_gracefully "${port_pids[@]}"
  else
    log_error "Porta $VLLM_PORT ocupada e endpoint nao saudavel (status=$current_status)."
    log_error "Defina VLLM_KILL_PORT_OWNER=1 para encerrar processo antigo automaticamente."
    exit 1
  fi
fi

if ! is_positive_int "$VLLM_MIN_FREE_GPU_MB"; then
  log_error "VLLM_MIN_FREE_GPU_MB invalido: $VLLM_MIN_FREE_GPU_MB"
  exit 1
fi
guard_gpu_memory "$VLLM_GPU_INDEX" "$VLLM_MIN_FREE_GPU_MB" "$VLLM_REQUIRE_NVIDIA_SMI"

cmd=(
  "$VLLM_BIN" serve "$VLLM_MODEL_PATH"
  --host "$VLLM_HOST"
  --port "$VLLM_PORT"
  --served-model-name "$VLLM_SERVED_MODEL_NAME"
  --max-num-seqs "$VLLM_MAX_NUM_SEQS"
  --max-model-len "$VLLM_MAX_MODEL_LEN"
  --gpu-memory-utilization "$VLLM_GPU_MEMORY_UTILIZATION"
)

if is_positive_int "$VLLM_TENSOR_PARALLEL_SIZE"; then
  cmd+=(--tensor-parallel-size "$VLLM_TENSOR_PARALLEL_SIZE")
fi

if [[ -n "$VLLM_EXTRA_ARGS" ]]; then
  # shellcheck disable=SC2206
  extra_args=( $VLLM_EXTRA_ARGS )
  cmd+=("${extra_args[@]}")
fi

log_info "Subindo vLLM com host=$VLLM_HOST port=$VLLM_PORT model_path=$VLLM_MODEL_PATH served_model=$VLLM_SERVED_MODEL_NAME."
log_info "Perfil: max_num_seqs=$VLLM_MAX_NUM_SEQS max_model_len=$VLLM_MAX_MODEL_LEN gpu_memory_utilization=$VLLM_GPU_MEMORY_UTILIZATION."

exec "${cmd[@]}"
