#!/usr/bin/env python3
"""OpenAI-compatible embeddings server running on CPU."""

from __future__ import annotations

import base64
import io
import os
from typing import List, Union

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from PIL import Image
import numpy as np
import torch
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer

try:
    from facenet_pytorch import InceptionResnetV1, MTCNN
except Exception:  # noqa: BLE001
    InceptionResnetV1 = None
    MTCNN = None


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
FACE_MODEL_NAME = (os.getenv("EMBEDDING_CPU_FACE_MODEL") or "facenet-pytorch-inceptionresnetv1-vggface2").strip()
FACE_BACKEND = (os.getenv("EMBEDDING_CPU_FACE_BACKEND") or "facenet").strip().lower() or "facenet"
FACE_DETECT_DEFAULT = parse_bool(os.getenv("EMBEDDING_CPU_FACE_DETECT"), True)
FACE_OUTPUT_DIMENSION = max(64, int(os.getenv("EMBEDDING_CPU_FACE_OUTPUT_DIM", "768")))
FACE_MAX_INPUTS = max(1, int(os.getenv("EMBEDDING_CPU_FACE_MAX_INPUTS", "16")))
FACE_MAX_IMAGE_BYTES = max(1024, int(os.getenv("EMBEDDING_CPU_FACE_MAX_IMAGE_BYTES", str(8 * 1024 * 1024))))
FACE_PRETRAINED = (os.getenv("EMBEDDING_CPU_FACE_PRETRAINED") or "vggface2").strip() or "vggface2"

_tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
_model = AutoModel.from_pretrained(MODEL_NAME).to(DEVICE)
_model.eval()
_dimension = int(getattr(_model.config, "hidden_size", 0) or 0)
_face_mtcnn: MTCNN | None = None
_face_model: InceptionResnetV1 | None = None

if _dimension <= 0:
    raise RuntimeError(f"Failed to resolve embedding dimension for model '{MODEL_NAME}'.")


class EmbeddingRequest(BaseModel):
    model: str | None = None
    input: Union[str, List[str]]
    encoding_format: str | None = "float"


class FaceEmbeddingRequest(BaseModel):
    model: str | None = None
    input: Union[str, List[str]]
    detect_face: bool | None = None
    output_dimension: int | None = None
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


def normalize_image_inputs(value: Union[str, List[str]]) -> List[str]:
    items = [value] if isinstance(value, str) else list(value)
    normalized: List[str] = []
    for item in items:
        text = str(item).strip()
        if not text:
            continue
        normalized.append(text)
    if not normalized:
        raise HTTPException(status_code=400, detail="Empty input.")
    if len(normalized) > FACE_MAX_INPUTS:
        raise HTTPException(status_code=400, detail=f"Too many image inputs. max_inputs={FACE_MAX_INPUTS}.")
    return normalized


def decode_image_payload(payload: str) -> bytes:
    raw = payload.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image payload.")
    if raw.startswith("data:"):
        comma_idx = raw.find(",")
        if comma_idx < 0:
            raise HTTPException(status_code=400, detail="Invalid data URL image payload.")
        raw = raw[comma_idx + 1 :]
    try:
        decoded = base64.b64decode(raw, validate=False)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid base64 image payload: {exc}") from exc
    if not decoded:
        raise HTTPException(status_code=400, detail="Decoded image payload is empty.")
    if len(decoded) > FACE_MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail=f"Image too large. max_bytes={FACE_MAX_IMAGE_BYTES}.")
    return decoded


def decode_image(payload: str) -> Image.Image:
    decoded = decode_image_payload(payload)
    try:
        image = Image.open(io.BytesIO(decoded)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Unsupported image format: {exc}") from exc
    return image


def ensure_face_model() -> tuple[MTCNN, InceptionResnetV1]:
    global _face_mtcnn, _face_model
    if FACE_BACKEND != "facenet":
        raise HTTPException(status_code=500, detail=f"Unsupported face backend '{FACE_BACKEND}'.")
    if InceptionResnetV1 is None or MTCNN is None:
        raise HTTPException(status_code=500, detail="facenet_pytorch not available in runtime.")
    if _face_mtcnn is None:
        _face_mtcnn = MTCNN(
            image_size=160,
            margin=12,
            keep_all=False,
            post_process=True,
            device=DEVICE,
        )
    if _face_model is None:
        _face_model = InceptionResnetV1(pretrained=FACE_PRETRAINED).eval().to(DEVICE)
    return _face_mtcnn, _face_model


def fallback_face_tensor(image: Image.Image) -> torch.Tensor:
    resized = image.resize((160, 160))
    array = torch.from_numpy(np.asarray(resized).astype("float32"))
    if array.ndim == 2:
        array = array.unsqueeze(-1).repeat(1, 1, 3)
    if array.shape[-1] > 3:
        array = array[:, :, :3]
    tensor = array.permute(2, 0, 1).contiguous()
    tensor = (tensor - 127.5) / 128.0
    return tensor


def adapt_dimension(vector: torch.Tensor, target_dim: int) -> torch.Tensor:
    source_dim = int(vector.shape[-1])
    if source_dim == target_dim:
        return vector
    if source_dim > target_dim:
        return vector[..., :target_dim]
    repeats = (target_dim + source_dim - 1) // source_dim
    expanded = vector.repeat(1, repeats)
    return expanded[..., :target_dim]


def compute_face_embedding(image: Image.Image, *, detect_face: bool, output_dimension: int) -> List[float]:
    mtcnn, model = ensure_face_model()
    face_tensor = mtcnn(image) if detect_face else None
    if face_tensor is None:
        face_tensor = fallback_face_tensor(image)
    if face_tensor.ndim == 3:
        face_tensor = face_tensor.unsqueeze(0)
    face_tensor = face_tensor.to(DEVICE)
    with torch.no_grad():
        vector = model(face_tensor)
        vector = F.normalize(vector, p=2, dim=1)
        vector = adapt_dimension(vector, output_dimension)
        vector = F.normalize(vector, p=2, dim=1)
        vector = vector.cpu().float()[0]
    return vector.tolist()


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_NAME,
        "dimension": _dimension,
        "device": DEVICE,
        "normalize_embeddings": NORMALIZE_EMBEDDINGS,
        "face_model": FACE_MODEL_NAME,
        "face_backend": FACE_BACKEND,
        "face_output_dimension": FACE_OUTPUT_DIMENSION,
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


@app.post("/v1/face-embeddings")
def create_face_embeddings(payload: FaceEmbeddingRequest, authorization: str | None = Header(default=None)):
    require_api_key(authorization)
    if payload.model and payload.model != FACE_MODEL_NAME:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported face model '{payload.model}'. Expected '{FACE_MODEL_NAME}'.",
        )

    output_dimension = payload.output_dimension or FACE_OUTPUT_DIMENSION
    output_dimension = max(64, min(2048, int(output_dimension)))
    detect_face = FACE_DETECT_DEFAULT if payload.detect_face is None else bool(payload.detect_face)

    items = normalize_image_inputs(payload.input)
    vectors: List[List[float]] = []
    for item in items:
        image = decode_image(item)
        vector = compute_face_embedding(
            image,
            detect_face=detect_face,
            output_dimension=output_dimension,
        )
        vectors.append(vector)

    data = []
    for index, vector in enumerate(vectors):
        data.append(
            {
                "object": "embedding",
                "index": index,
                "embedding": vector,
                "model": FACE_MODEL_NAME,
            }
        )

    return {
        "object": "list",
        "model": FACE_MODEL_NAME,
        "data": data,
        "usage": {"prompt_tokens": 0, "total_tokens": 0},
    }


if __name__ == "__main__":
    import uvicorn

    host = (os.getenv("EMBEDDING_CPU_HOST") or "127.0.0.1").strip()
    port = int(os.getenv("EMBEDDING_CPU_PORT", "8001"))
    uvicorn.run(app, host=host, port=port, log_level="info")
