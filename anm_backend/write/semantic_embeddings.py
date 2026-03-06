"""
FILE: write/semantic_embeddings.py
RESPONSIBILITY: Deterministic embedding helpers for write-domain semantic retrieval.
FLOW ROLE: Convert text into fixed-size vectors and score cosine similarity.
READS: Text payloads from write sections/chunks/process memory.
RAM WRITES: Temporary embedding vectors.
PERSISTS: None.
PRIMARY RISK: Hash-based embeddings are weaker than model embeddings for nuanced semantics.
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from dataclasses import dataclass
from typing import List

_TOKEN_RE = re.compile(r"[a-z0-9_]+", re.IGNORECASE)
_MULTISPACE_RE = re.compile(r"\s+")


def _normalize_text(value: str) -> str:
    text = _MULTISPACE_RE.sub(" ", str(value or "").strip().lower())
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(char for char in normalized if not unicodedata.combining(char))


@dataclass(frozen=True)
class DeterministicEmbeddingProvider:
    dimension: int = 768
    model_name: str = "deterministic-hash-embed-v1"

    def embed(self, text: str) -> List[float]:
        normalized = _normalize_text(text)
        vector = [0.0] * max(8, int(self.dimension))
        if not normalized:
            return vector
        tokens = _TOKEN_RE.findall(normalized)
        if not tokens:
            return vector

        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            for offset in range(0, min(len(digest), 24), 3):
                slot = int.from_bytes(digest[offset : offset + 2], byteorder="big", signed=False) % len(vector)
                sign = 1.0 if digest[offset + 2] % 2 == 0 else -1.0
                vector[slot] += sign

        norm = math.sqrt(sum(value * value for value in vector))
        if norm <= 0:
            return vector
        return [value / norm for value in vector]


def cosine_similarity(left: List[float], right: List[float]) -> float:
    if not left or not right:
        return 0.0
    size = min(len(left), len(right))
    if size <= 0:
        return 0.0
    dot = 0.0
    left_norm = 0.0
    right_norm = 0.0
    for index in range(size):
        left_value = float(left[index])
        right_value = float(right[index])
        dot += left_value * right_value
        left_norm += left_value * left_value
        right_norm += right_value * right_value
    if left_norm <= 0.0 or right_norm <= 0.0:
        return 0.0
    return dot / math.sqrt(left_norm * right_norm)
