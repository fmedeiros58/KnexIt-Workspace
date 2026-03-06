"""
FILE: services/response_orchestration/contradiction_guard_service.py
RESPONSIBILITY: Lightweight contradiction checks between new chunks and established claims.
FLOW ROLE: Flag hard consistency risks before continuing cycles.
READS: Candidate chunk and established key claims.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Heuristic false positives due lexical simplification.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from anm_backend.services.response_orchestration.types import GuardOutcome


def _normalize(value: str) -> str:
    text = re.sub(r"\s+", " ", str(value or "").strip().lower())
    return text.replace("não", "nao")


def _strip_negation(value: str) -> str:
    return re.sub(r"\bnao\b", "", value).strip()


@dataclass
class ContradictionGuardService:
    enabled: bool = False

    def evaluate(self, *, candidate_chunk: str, key_claims: Iterable[str]) -> GuardOutcome:
        if not self.enabled:
            return GuardOutcome(passed=True, should_stop=False, reason="disabled", score=0.0)

        candidate = _normalize(candidate_chunk)
        if not candidate:
            return GuardOutcome(passed=False, should_stop=True, reason="empty_chunk", score=1.0)

        for claim in key_claims:
            normalized_claim = _normalize(claim)
            if not normalized_claim:
                continue
            claim_has_negation = " nao " in f" {normalized_claim} "
            claim_without_negation = _strip_negation(normalized_claim)
            if len(claim_without_negation) < 8:
                continue

            candidate_has_phrase = claim_without_negation in candidate
            candidate_has_negation = f"nao {claim_without_negation}" in candidate
            if claim_has_negation and candidate_has_phrase and not candidate_has_negation:
                return GuardOutcome(
                    passed=False,
                    should_stop=True,
                    reason="contradiction_negation_flip",
                    score=0.92,
                    details={"claim": claim},
                )
            if (not claim_has_negation) and candidate_has_negation:
                return GuardOutcome(
                    passed=False,
                    should_stop=True,
                    reason="contradiction_negation_flip",
                    score=0.92,
                    details={"claim": claim},
                )

        return GuardOutcome(passed=True, should_stop=False, reason="ok", score=0.0)

