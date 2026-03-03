#!/usr/bin/env python3
"""OpenAI-compatible embeddings server running on CPU."""

from __future__ import annotations

import os
from typing import List, Union

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import torch
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer


def parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


MODEL_NAME = (os.getenv("EMBEDDING_CPU_MODEL") or "intfloat/multilingual-e5-base").strip()
API_KEY = (os.getenv("EMBEDDING_CPU_API_KEY") or "token-local").strip()
DEVICE = (os.getenv("EMBEDDING_CPU_DEVICE") or "cpu").strip() or "cpu"
NORMALIZE_EMBEDDINGS = parse_bool(os.getenv("EMBEDDING_CPU_NORMALIZE"), True)
MAX_INPUTS = max(1, int(os.getenv("EMBEDDING_CPU_MAX_INPUTS", "128")))
MAX_CHARS = max(32, int(os.getenv("EMBEDDING_CPU_MAX_CHARS", "20000")))

_tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
_model = AutoModel.from_pretrained(MODEL_NAME).to(DEVICE)
_model.eval()
_dimension = int(getattr(_model.config, "hidden_size", 0) or 0)

if _dimension <= 0:
    raise RuntimeError(f"Failed to resolve embedding dimension for model '{MODEL_NAME}'.")


class EmbeddingRequest(BaseModel):
    model: str | None = None
    input: Union[str, List[str]]
    encoding_format: str | None = "float"


app = FastAPI(title="Embedding CPU Server", version="1.0.0")


def require_api_key(authorization: str | None) -> None:
    if not API_KEY:
        return
    expected = f"Bearer {API_KEY}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized.")


def normalize_inputs(value: Union[str, List[str]]) -> List[str]:
    items = [value] if isinstance(value, str) else list(value)
    normalized: List[str] = []
    for item in items:
        text = str(item).strip()
        if not text:
            continue
        if len(text) > MAX_CHARS:
            raise HTTPException(
                status_code=400,
                detail=f"Input too large. max_chars={MAX_CHARS}.",
            )
        normalized.append(text)

    if not normalized:
        raise HTTPException(status_code=400, detail="Empty input.")
    if len(normalized) > MAX_INPUTS:
        raise HTTPException(
            status_code=400,
            detail=f"Too many inputs. max_inputs={MAX_INPUTS}.",
        )
    return normalized


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_NAME,
        "dimension": _dimension,
        "device": DEVICE,
        "normalize_embeddings": NORMALIZE_EMBEDDINGS,
    }


@app.get("/v1/models")
def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": MODEL_NAME,
                "object": "model",
                "owned_by": "local-cpu",
            }
        ],
    }


@app.post("/v1/embeddings")
def create_embeddings(payload: EmbeddingRequest, authorization: str | None = Header(default=None)):
    require_api_key(authorization)

    if payload.model and payload.model != MODEL_NAME:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported model '{payload.model}'. Expected '{MODEL_NAME}'.",
        )

    inputs = normalize_inputs(payload.input)
    encoded = _tokenizer(
        inputs,
        padding=True,
        truncation=True,
        max_length=512,
        return_tensors="pt",
    )
    encoded = {name: tensor.to(DEVICE) for name, tensor in encoded.items()}

    with torch.no_grad():
        model_output = _model(**encoded)
        token_embeddings = model_output.last_hidden_state
        attention_mask = encoded["attention_mask"]
        expanded_mask = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        summed = torch.sum(token_embeddings * expanded_mask, dim=1)
        counts = torch.clamp(expanded_mask.sum(dim=1), min=1e-9)
        vectors = summed / counts
        if NORMALIZE_EMBEDDINGS:
            vectors = F.normalize(vectors, p=2, dim=1)
        vectors = vectors.cpu().float().numpy()

    if len(vectors.shape) == 1:
        vectors = vectors.reshape(1, -1)

    data = []
    for index, vector in enumerate(vectors):
        data.append(
            {
                "object": "embedding",
                "index": index,
                "embedding": vector.astype("float32").tolist(),
                "model": MODEL_NAME,
            }
        )

    return {
        "object": "list",
        "model": MODEL_NAME,
        "data": data,
        "usage": {"prompt_tokens": 0, "total_tokens": 0},
    }


if __name__ == "__main__":
    import uvicorn

    host = (os.getenv("EMBEDDING_CPU_HOST") or "127.0.0.1").strip()
    port = int(os.getenv("EMBEDDING_CPU_PORT", "8001"))
    uvicorn.run(app, host=host, port=port, log_level="info")
