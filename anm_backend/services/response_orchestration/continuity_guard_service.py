"""
FILE: services/response_orchestration/continuity_guard_service.py
RESPONSIBILITY: Detect continuity break risks between generated chunks.
FLOW ROLE: Guard against restart-style openings in multi-cycle generation.
READS: Candidate chunk and prior continuity bridge.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Overly strict restart detection for legitimate transitions.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from anm_backend.services.response_orchestration.types import GuardOutcome

_RESTART_PREFIXES = (
    "claro",
    "vamos",
    "em resumo",
    "para começar",
    "primeiramente",
    "neste texto",
)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


@dataclass
class ContinuityGuardService:
    def evaluate(self, *, candidate_chunk: str, cycle_index: int) -> GuardOutcome:
        normalized = _normalize(candidate_chunk)
        if not normalized:
            return GuardOutcome(passed=False, should_stop=True, reason="empty_chunk", score=1.0)
        if cycle_index <= 1:
            return GuardOutcome(passed=True, should_stop=False, reason="ok", score=0.0)

        first_line = normalized.split("\n", 1)[0].strip()
        first_tokens = " ".join(first_line.split(" ")[:4])
        for prefix in _RESTART_PREFIXES:
            if first_tokens.startswith(prefix):
                return GuardOutcome(
                    passed=False,
                    should_stop=False,
                    reason="restart_risk_detected",
                    score=0.72,
                    details={"prefix": prefix},
                )
        return GuardOutcome(passed=True, should_stop=False, reason="ok", score=0.0)

