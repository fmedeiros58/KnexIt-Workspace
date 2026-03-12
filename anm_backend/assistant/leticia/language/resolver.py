"""Locale resolver for Leticia assistant kernel."""

from __future__ import annotations

from anm_backend.assistant.leticia.types import LeticiaLocale
from anm_backend.utils import detect_user_language


def _normalize_hint(locale_hint: str) -> str:
    return str(locale_hint or "").strip().lower().replace("_", "-")


def _map_language_tag(tag: str) -> LeticiaLocale:
    normalized = _normalize_hint(tag)
    if normalized.startswith("en"):
        return "en-US"
    if normalized.startswith("es"):
        return "es-ES"
    return "pt-BR"


def resolve_leticia_locale(*, text: str, locale_hint: str = "") -> LeticiaLocale:
    normalized_hint = _normalize_hint(locale_hint)
    if normalized_hint:
        return _map_language_tag(normalized_hint)
    detected = detect_user_language(text)
    return _map_language_tag(detected)

