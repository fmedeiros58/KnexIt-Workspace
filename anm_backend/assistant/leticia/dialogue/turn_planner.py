"""Turn planning for short/direct Leticia responses."""

from __future__ import annotations

from anm_backend.assistant.leticia.dialogue.mode_resolver import resolve_leticia_dialogue_mode
from anm_backend.assistant.leticia.types import LeticiaIntent, LeticiaLocale, LeticiaTurnPlan


def _greeting_reply_by_locale(locale: LeticiaLocale, normalized_text: str) -> str:
    value = normalized_text.strip()
    if locale == "en-US":
        if value.startswith("good morning"):
            return "Good morning. How can I help?"
        if value.startswith("good afternoon"):
            return "Good afternoon. How can I help?"
        if value.startswith("good evening"):
            return "Good evening. How can I help?"
        return "Hello. How can I help?"
    if locale == "es-ES":
        if value.startswith("buenos dias"):
            return "Buenos dias. Como puedo ayudar?"
        if value.startswith("buenas tardes"):
            return "Buenas tardes. Como puedo ayudar?"
        if value.startswith("buenas noches"):
            return "Buenas noches. Como puedo ayudar?"
        return "Hola. Como puedo ayudar?"
    if value.startswith("bom dia"):
        return "Bom dia. Como posso ajudar?"
    if value.startswith("boa tarde"):
        return "Boa tarde. Como posso ajudar?"
    if value.startswith("boa noite"):
        return "Boa noite. Como posso ajudar?"
    return "Oi. Como posso ajudar?"


def _reply_by_locale(locale: LeticiaLocale, kind: str) -> str:
    replies = {
        "pt-BR": {
            "checkin": "Estou bem e pronta para ajudar, como posso te ajudar agora?",
            "gratitude": "Por nada.",
            "farewell": "Ate mais.",
            "confirmation": "Certo.",
            "negation": "Tudo bem.",
            "clarify": "Pode me dizer com mais clareza o que voce precisa?",
            "help": "Claro. Me diga no que voce precisa de ajuda.",
        },
        "en-US": {
            "checkin": "I am doing well and ready to help, what do you need now?",
            "gratitude": "You are welcome.",
            "farewell": "See you later.",
            "confirmation": "Alright.",
            "negation": "Okay.",
            "clarify": "Can you tell me more clearly what you need?",
            "help": "Sure. Tell me what you need help with.",
        },
        "es-ES": {
            "checkin": "Estoy bien y lista para ayudar, que necesitas ahora?",
            "gratitude": "De nada.",
            "farewell": "Hasta luego.",
            "confirmation": "De acuerdo.",
            "negation": "Esta bien.",
            "clarify": "Puedes decirme con mas claridad que necesitas?",
            "help": "Claro. Dime en que necesitas ayuda.",
        },
    }
    return str(replies[locale][kind])


def plan_leticia_turn(intent: LeticiaIntent) -> LeticiaTurnPlan:
    mode = resolve_leticia_dialogue_mode(intent)
    if intent.name == "greeting":
        return LeticiaTurnPlan(mode=mode, direct_reply=_greeting_reply_by_locale(intent.locale, intent.normalized_text), prompt_prefix="")
    if intent.name == "checkin":
        return LeticiaTurnPlan(mode=mode, direct_reply=_reply_by_locale(intent.locale, "checkin"), prompt_prefix="")
    if intent.name == "gratitude":
        return LeticiaTurnPlan(mode=mode, direct_reply=_reply_by_locale(intent.locale, "gratitude"), prompt_prefix="")
    if intent.name == "farewell":
        return LeticiaTurnPlan(mode=mode, direct_reply=_reply_by_locale(intent.locale, "farewell"), prompt_prefix="")
    if intent.name == "confirmation":
        return LeticiaTurnPlan(mode=mode, direct_reply=_reply_by_locale(intent.locale, "confirmation"), prompt_prefix="")
    if intent.name == "negation":
        return LeticiaTurnPlan(mode=mode, direct_reply=_reply_by_locale(intent.locale, "negation"), prompt_prefix="")
    if intent.name == "help_request" and intent.is_micro_turn:
        return LeticiaTurnPlan(mode=mode, direct_reply=_reply_by_locale(intent.locale, "help"), prompt_prefix="")
    if intent.name == "ambiguous":
        return LeticiaTurnPlan(mode=mode, direct_reply=_reply_by_locale(intent.locale, "clarify"), prompt_prefix="")
    return LeticiaTurnPlan(
        mode=mode,
        direct_reply=None,
        prompt_prefix="Responda ao usuario de forma conversacional, direta e natural.",
    )
