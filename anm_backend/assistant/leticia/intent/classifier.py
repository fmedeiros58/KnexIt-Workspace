"""Intent classifier used by Leticia assistant kernel."""

from __future__ import annotations

import re

from anm_backend.assistant.leticia.language import resolve_leticia_locale
from anm_backend.assistant.leticia.types import LeticiaIntent
from anm_backend.assistant.leticia.utils import compact_whitespace, normalize_for_intent_match

_GREETING_PATTERNS = [
    re.compile(r"^(oi|ola|opa|e ai|eae|hey|hello|hi)\b"),
    re.compile(r"^(bom dia|boa tarde|boa noite)\b"),
    re.compile(r"^(hola|buenos dias|buenas tardes|buenas noches)\b"),
]
_CHECKIN_PATTERNS = [
    re.compile(r"^(como (vc|voce) esta|como vai|tudo bem|td bem|tudo certo|que tal)$"),
    re.compile(r"^(how are you|how is it going)$"),
    re.compile(r"^(como estas|que tal)$"),
]
_GRATITUDE_PATTERNS = [re.compile(r"^(obrigado|obrigada|obg|valeu|gracias|thanks|thank you)$")]
_FAREWELL_PATTERNS = [re.compile(r"^(tchau|ate logo|ate mais|falou|bye|goodbye|hasta luego)$")]
_CONFIRMATION_PATTERNS = [re.compile(r"^(sim|isso|ok|okay|certo|perfeito|yes|yep|si)$")]
_NEGATION_PATTERNS = [re.compile(r"^(nao|negativo|nope|no)$")]
_HELP_PATTERNS = [re.compile(r"\b(me ajuda|preciso de ajuda|can you help|ayudame|ajuda)\b")]
_QUESTION_PATTERNS = [re.compile(r"[?]$"), re.compile(r"\b(como|qual|quais|quando|onde|por que|porque|quem|what|when|where|why|who|how)\b")]
_COMMAND_PATTERNS = [re.compile(r"^(abra|mostre|liste|gere|crie|faca|execute|run|open|show)\b")]


def _matches_any(patterns: list[re.Pattern[str]], value: str) -> bool:
    return any(pattern.search(value) for pattern in patterns)


def classify_leticia_intent(text: str, *, locale_hint: str = "") -> LeticiaIntent:
    normalized_text = compact_whitespace(text)
    folded = normalize_for_intent_match(normalized_text)
    locale = resolve_leticia_locale(text=normalized_text, locale_hint=locale_hint)
    words = [token for token in folded.split(" ") if token]
    is_micro_turn = len(normalized_text) <= 64 and len(words) <= 10

    if not folded:
        return LeticiaIntent(
            name="ambiguous",
            locale=locale,
            normalized_text=folded,
            confidence=0.2,
            expects_direct_reply=False,
            is_micro_turn=True,
        )

    if _matches_any(_GREETING_PATTERNS, folded) and len(words) <= 6:
        return LeticiaIntent("greeting", locale, folded, 0.98, True, True)
    if _matches_any(_CHECKIN_PATTERNS, folded) and len(words) <= 8:
        return LeticiaIntent("checkin", locale, folded, 0.98, True, True)
    if _matches_any(_GRATITUDE_PATTERNS, folded):
        return LeticiaIntent("gratitude", locale, folded, 0.98, True, True)
    if _matches_any(_FAREWELL_PATTERNS, folded):
        return LeticiaIntent("farewell", locale, folded, 0.97, True, True)
    if _matches_any(_CONFIRMATION_PATTERNS, folded):
        return LeticiaIntent("confirmation", locale, folded, 0.9, True, is_micro_turn)
    if _matches_any(_NEGATION_PATTERNS, folded):
        return LeticiaIntent("negation", locale, folded, 0.9, True, is_micro_turn)
    if _matches_any(_HELP_PATTERNS, folded):
        return LeticiaIntent("help_request", locale, folded, 0.88, True, is_micro_turn)
    if _matches_any(_COMMAND_PATTERNS, folded):
        return LeticiaIntent("command", locale, folded, 0.8, True, is_micro_turn)
    if _matches_any(_QUESTION_PATTERNS, normalized_text) or _matches_any(_QUESTION_PATTERNS, folded):
        return LeticiaIntent("question", locale, folded, 0.8, True, is_micro_turn)

    return LeticiaIntent(
        name="statement",
        locale=locale,
        normalized_text=folded,
        confidence=0.62 if is_micro_turn else 0.74,
        expects_direct_reply=False,
        is_micro_turn=is_micro_turn,
    )
