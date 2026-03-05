"""
FILE: utils/language_policy.py
RESPONSIBILITY: Lightweight language detection and rendering policy helpers.
FLOW ROLE: Enforce answer language consistency across multi-pass generation.
READS: Input text only.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Heuristic misclassification for very short prompts.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Dict

_PT_HINTS = {
    "o",
    "a",
    "os",
    "as",
    "de",
    "do",
    "da",
    "dos",
    "das",
    "como",
    "porque",
    "por",
    "que",
    "quais",
    "qual",
    "responda",
    "explique",
    "consequencias",
    "sintomas",
    "tratamento",
    "prevencao",
}
_EN_HINTS = {
    "the",
    "and",
    "for",
    "with",
    "what",
    "which",
    "how",
    "why",
    "explain",
    "answer",
    "consequences",
    "symptoms",
    "treatment",
    "prevention",
}
_ES_HINTS = {
    "el",
    "la",
    "los",
    "las",
    "de",
    "del",
    "como",
    "porque",
    "que",
    "cuales",
    "explica",
    "respuesta",
    "consecuencias",
    "sintomas",
    "tratamiento",
    "prevencion",
}
_FR_HINTS = {
    "le",
    "la",
    "les",
    "de",
    "des",
    "du",
    "comment",
    "pourquoi",
    "quoi",
    "quels",
    "explique",
    "reponse",
}


def _normalize(text: str) -> str:
    lowered = str(text or "").strip().lower()
    if not lowered:
        return ""
    decomposed = unicodedata.normalize("NFKD", lowered)
    no_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", no_accents).strip()


def _tokenize(text: str) -> list[str]:
    normalized = _normalize(text)
    if not normalized:
        return []
    return [token for token in re.split(r"[^a-z0-9]+", normalized) if token]


def _score(tokens: list[str], hints: set[str]) -> int:
    return sum(1 for token in tokens if token in hints)


def detect_user_language(text: str) -> str:
    """
    Returns:
        str: BCP47-like short tag (`pt-BR`, `en-US`, `es-ES`, `fr-FR`).
    """

    raw = str(text or "").strip()
    if not raw:
        return "pt-BR"
    if re.search(r"[áàâãéêíóôõúç]", raw, re.IGNORECASE):
        return "pt-BR"

    tokens = _tokenize(raw)
    if not tokens:
        return "pt-BR"

    scores: Dict[str, int] = {
        "pt-BR": _score(tokens, _PT_HINTS),
        "en-US": _score(tokens, _EN_HINTS),
        "es-ES": _score(tokens, _ES_HINTS),
        "fr-FR": _score(tokens, _FR_HINTS),
    }
    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return "pt-BR"
    return best


def describe_language(tag: str) -> str:
    normalized = str(tag or "").strip().lower()
    if normalized.startswith("en"):
        return "ingles"
    if normalized.startswith("es"):
        return "espanhol"
    if normalized.startswith("fr"):
        return "frances"
    return "portugues brasileiro"

