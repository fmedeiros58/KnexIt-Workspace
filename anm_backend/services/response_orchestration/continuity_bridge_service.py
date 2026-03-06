"""
FILE: services/response_orchestration/continuity_bridge_service.py
RESPONSIBILITY: Build continuity anchors between segmented Phase 0 calls.
FLOW ROLE: Preserve textual continuity and avoid artificial restart in call chaining.
READS: First chunk text plus preferred connector/join strategy.
RAM WRITES: None directly (caller persists bridge state).
PERSISTS: None.
PRIMARY RISK: Over-correction can alter intended style.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

from anm_backend.services.response_orchestration.paragraph_segmenter_service import OPEN_SYNTAX_CONNECTORS

_RESTART_PREFIXES = (
    "em resumo",
    "em sintese",
    "primeiramente",
    "para concluir",
    "concluindo",
    "retomando do inicio",
    "reiniciando",
)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _strip_trailing_terminal_punctuation(value: str) -> str:
    text = str(value or "").rstrip()
    while text and text[-1] in ".!?":
        text = text[:-1].rstrip()
    return text


def _contains_open_connector(value: str) -> str:
    lowered = _normalize(value).lower()
    for connector in OPEN_SYNTAX_CONNECTORS:
        if lowered.endswith(connector):
            return connector
    return ""


def _last_words(value: str, *, limit: int) -> str:
    words = [token for token in _normalize(value).split(" ") if token]
    if not words:
        return ""
    return " ".join(words[-max(1, limit):])


@dataclass
class ContinuityBridgeState:
    first_chunk: str
    continuation_anchor: str
    join_rule: str
    connector_used: str
    injected_connector: bool


@dataclass
class ContinuityBridgeService:
    def prepare_first_chunk(
        self,
        *,
        first_chunk: str,
        preferred_connector: str,
        join_rule: str,
    ) -> ContinuityBridgeState:
        cleaned = _strip_trailing_terminal_punctuation(_normalize(first_chunk))
        connector = str(preferred_connector or "").strip().lower()
        if connector not in OPEN_SYNTAX_CONNECTORS:
            connector = OPEN_SYNTAX_CONNECTORS[0]

        detected_connector = _contains_open_connector(cleaned)
        injected = False
        if detected_connector:
            connector = detected_connector
        elif cleaned:
            cleaned = f"{cleaned} {connector}".strip()
            injected = True
        else:
            cleaned = connector
            injected = True

        continuation_anchor = _last_words(cleaned, limit=12)
        if not continuation_anchor:
            continuation_anchor = connector

        return ContinuityBridgeState(
            first_chunk=cleaned,
            continuation_anchor=continuation_anchor,
            join_rule=_normalize(join_rule) or "segunda chamada nao reinicia sujeito principal",
            connector_used=connector,
            injected_connector=injected,
        )

    def detect_artificial_restart(self, *, continuation_chunk: str) -> bool:
        normalized = _normalize(continuation_chunk).lower()
        if not normalized:
            return False
        return any(normalized.startswith(prefix) for prefix in _RESTART_PREFIXES)

    def restart_prefixes(self) -> List[str]:
        return list(_RESTART_PREFIXES)
