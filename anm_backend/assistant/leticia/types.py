"""Typed contracts used by Leticia assistant kernel."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Literal, TypedDict

LeticiaLocale = Literal["pt-BR", "en-US", "es-ES"]
LeticiaIntentName = Literal[
    "greeting",
    "checkin",
    "gratitude",
    "farewell",
    "confirmation",
    "negation",
    "help_request",
    "question",
    "command",
    "statement",
    "ambiguous",
]
LeticiaDialogueMode = Literal[
    "social",
    "direct_answer",
    "clarify",
    "assist",
    "command",
    "contextual",
]


class LeticiaHistoryItem(TypedDict):
    role: Literal["user", "assistant"]
    content: str


@dataclass(frozen=True)
class LeticiaIntent:
    name: LeticiaIntentName
    locale: LeticiaLocale
    normalized_text: str
    confidence: float
    expects_direct_reply: bool
    is_micro_turn: bool


@dataclass(frozen=True)
class LeticiaTurnPlan:
    mode: LeticiaDialogueMode
    direct_reply: str | None
    prompt_prefix: str


@dataclass(frozen=True)
class LeticiaKernelOutput:
    locale: LeticiaLocale
    intent: LeticiaIntent
    plan: LeticiaTurnPlan
    enriched_prompt: str
    context_summary: str
    metadata: Dict[str, Any]
