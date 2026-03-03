#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

exec "$PYTHON_BIN" -m uvicorn anm_backend.main:app --host "$ANM_HOST" --port "$ANM_PORT"
