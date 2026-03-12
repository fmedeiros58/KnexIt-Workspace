"""Text helpers for Leticia assistant kernel."""

from __future__ import annotations

import re
import unicodedata


def compact_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_for_match(value: str) -> str:
    compacted = compact_whitespace(value).lower()
    decomposed = unicodedata.normalize("NFD", compacted)
    without_marks = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return without_marks


def normalize_for_intent_match(value: str) -> str:
    normalized = normalize_for_match(value)
    normalized = re.sub(r"[!?.,;:()[\]{}\"'`~^/_\\|@#$%&*+=<>-]+", " ", normalized)
    return compact_whitespace(normalized)


def sanitize_model_facing_text(value: str) -> str:
    return compact_whitespace(str(value or "").replace("\u0000", ""))

