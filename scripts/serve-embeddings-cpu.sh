#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 nao encontrado no WSL. Instale Python 3 para subir embeddings em CPU."
  exit 1
fi

DEFAULT_VENV_DIR="$ROOT_DIR/.emb-venv"
if [ -x "$HOME/vllm-venv/bin/python3" ]; then
  DEFAULT_VENV_DIR="$HOME/vllm-venv"
fi

VENV_DIR="${EMBEDDING_CPU_VENV_DIR:-$DEFAULT_VENV_DIR}"
if [ ! -x "$VENV_DIR/bin/python3" ]; then
  echo "Criando virtualenv de embeddings CPU em $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
fi

PYTHON_BIN="$VENV_DIR/bin/python3"
if ! "$PYTHON_BIN" -c "import fastapi, uvicorn, torch, transformers, numpy, PIL" >/dev/null 2>&1; then
  echo "Instalando dependencias de embeddings CPU..."
  "$PYTHON_BIN" -m pip install --upgrade pip
  "$PYTHON_BIN" -m pip install -r scripts/requirements-embeddings-cpu.txt
fi

export TOKENIZERS_PARALLELISM="${TOKENIZERS_PARALLELISM:-false}"
export EMBEDDING_CPU_MODEL="${EMBEDDING_CPU_MODEL:-intfloat/multilingual-e5-base}"
export EMBEDDING_CPU_DEVICE="${EMBEDDING_CPU_DEVICE:-cpu}"
export EMBEDDING_CPU_HOST="${EMBEDDING_CPU_HOST:-0.0.0.0}"
export EMBEDDING_CPU_PORT="${EMBEDDING_CPU_PORT:-8001}"
export EMBEDDING_CPU_API_KEY="${EMBEDDING_CPU_API_KEY:-token-local}"
export EMBEDDING_CPU_NORMALIZE="${EMBEDDING_CPU_NORMALIZE:-1}"
export EMBEDDING_CPU_MAX_INPUTS="${EMBEDDING_CPU_MAX_INPUTS:-128}"
export EMBEDDING_CPU_MAX_CHARS="${EMBEDDING_CPU_MAX_CHARS:-20000}"

exec "$PYTHON_BIN" scripts/embedding_cpu_server.py
