#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

PYTHON_BIN="$VENV_DIR/bin/python3"

if ! "$PYTHON_BIN" -c "import uvicorn, fastapi, pydantic" >/dev/null 2>&1; then
  echo "Instalando dependencias do ANM no virtualenv..."
  "$PYTHON_BIN" -m pip install --upgrade pip
  "$PYTHON_BIN" -m pip install -r anm_backend/requirements.txt
fi

exec "$PYTHON_BIN" -m uvicorn anm_backend.main:app --host "$ANM_HOST" --port "$ANM_PORT"
