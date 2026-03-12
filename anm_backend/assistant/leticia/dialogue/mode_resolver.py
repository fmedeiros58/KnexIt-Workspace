"""Resolve dialogue mode from a classified intent."""

from __future__ import annotations

from anm_backend.assistant.leticia.types import LeticiaDialogueMode, LeticiaIntent


def resolve_leticia_dialogue_mode(intent: LeticiaIntent) -> LeticiaDialogueMode:
    if intent.name in {"greeting", "checkin", "gratitude", "farewell", "confirmation", "negation"}:
        return "social"
    if intent.name == "help_request":
        return "assist"
    if intent.name == "command":
        return "command"
    if intent.name == "question":
        return "direct_answer"
    if intent.name == "ambiguous":
        return "clarify"
    return "clarify" if intent.is_micro_turn else "contextual"
