"""Final cleaner for Leticia assistant responses."""

from __future__ import annotations

import re
import unicodedata

from anm_backend.assistant.leticia.guardrails import strip_leticia_meta_speech
from anm_backend.assistant.leticia.types import LeticiaLocale
from anm_backend.assistant.leticia.utils import compact_whitespace

_INTERNAL_ARTIFACT_PATTERNS = [
    re.compile(r"\b(?:wm|trace|leticia)-[a-z0-9][a-z0-9-]{5,}\b", re.IGNORECASE),
    re.compile(r"\b(?:entity[_-]?key|person[_-]?id|match[_-]?key)\s*[:=]\s*[\w:.-]+\b", re.IGNORECASE),
    re.compile(r"\[(?:/?identity_runtime_shared_memory|/?user_prompt|ram contexto ativo)\]", re.IGNORECASE),
]

_META_LINE_PATTERNS = [
    re.compile(r"\bpensamento estendido\b", re.IGNORECASE),
    re.compile(r"\bescrev[ae]\s+as?\s+orientacoes\s+para\s+o\s+arquivo\b", re.IGNORECASE),
    re.compile(r"\bnote:\b", re.IGNORECASE),
    re.compile(r"\bin this response\b", re.IGNORECASE),
    re.compile(r"\bi will follow\b", re.IGNORECASE),
    re.compile(r"\bnao possuo estado fisico ou emocional\b", re.IGNORECASE),
    re.compile(r"\bsou apenas um software\b", re.IGNORECASE),
]


def _fold_for_guard(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", str(value or ""))
    without_marks = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return without_marks.lower().strip()


def _strip_internal_artifacts(text: str) -> str:
    next_text = str(text or "")
    for pattern in _INTERNAL_ARTIFACT_PATTERNS:
        next_text = pattern.sub(" ", next_text)
    return compact_whitespace(next_text)


def _strip_meta_lines(text: str) -> str:
    kept_lines: list[str] = []
    for raw_line in str(text or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line in {"+", "-", "...", "```"}:
            continue
        folded = _fold_for_guard(line)
        if any(pattern.search(folded) for pattern in _META_LINE_PATTERNS):
            continue
        kept_lines.append(line)
    return "\n".join(kept_lines).strip()


def _trim_dangling_tail(text: str) -> str:
    normalized = str(text or "").strip()
    if not normalized:
        return ""
    normalized = re.sub(r"\s+,", ",", normalized)
    normalized = re.sub(r"\b(?:pois|because|therefore)\s+\.", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\s{2,}", " ", normalized).strip()
    if re.search(r"[.!?]\"?$", normalized):
        return normalized
    last_terminal = max(normalized.rfind("."), normalized.rfind("!"), normalized.rfind("?"))
    if last_terminal >= int(len(normalized) * 0.45):
        return normalized[: last_terminal + 1].strip()
    if re.search(r"[,;:]\s*$", normalized):
        return re.sub(r"[,;:]\s*$", ".", normalized).strip()
    return normalized


def _fallback_reply(locale: LeticiaLocale) -> str:
    if locale == "en-US":
        return "I can answer that more directly."
    if locale == "es-ES":
        return "Puedo responder eso de forma mas directa."
    return "Posso responder isso de forma mais direta."


def clean_leticia_response_text(text: str, *, locale: LeticiaLocale) -> str:
    cleaned = _strip_meta_lines(str(text or ""))
    cleaned = strip_leticia_meta_speech(cleaned)
    cleaned = _strip_internal_artifacts(cleaned)
    cleaned = _strip_meta_lines(cleaned)
    cleaned = _trim_dangling_tail(cleaned)
    cleaned = compact_whitespace(cleaned)
    if cleaned:
        return cleaned
    return _fallback_reply(locale)
