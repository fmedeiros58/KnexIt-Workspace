"""
FILE: services/response_orchestration/redundancy_guard_service.py
RESPONSIBILITY: Detect semantic repetition during multi-cycle generation.
FLOW ROLE: Prevent restarts and low-gain cycles.
READS: Current chunk and previous generated chunk history.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: False positives with very short chunks.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Set

from anm_backend.services.response_orchestration.types import GuardOutcome


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _tokenize(text: str) -> Set[str]:
    normalized = _normalize(text)
    tokens = re.findall(r"[a-zA-Z0-9à-ÿ]+", normalized, flags=re.IGNORECASE)
    return {token for token in tokens if len(token) >= 3}


def _jaccard(a: Set[str], b: Set[str]) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    intersection = len(a.intersection(b))
    union = len(a.union(b))
    return float(intersection) / float(max(1, union))


@dataclass
class RedundancyGuardService:
    def evaluate(
        self,
        *,
        candidate_chunk: str,
        previous_chunks: Iterable[str],
        threshold: float,
    ) -> GuardOutcome:
        normalized_candidate = _normalize(candidate_chunk)
        if not normalized_candidate:
            return GuardOutcome(passed=False, should_stop=True, reason="empty_chunk", score=1.0)

        candidate_tokens = _tokenize(normalized_candidate)
        best_score = 0.0
        for previous in previous_chunks:
            score = _jaccard(candidate_tokens, _tokenize(previous))
            if score > best_score:
                best_score = score

        semantic_gain = max(0.0, 1.0 - best_score)
        if best_score >= threshold:
            return GuardOutcome(
                passed=False,
                should_stop=True,
                reason="redundancy_threshold_exceeded",
                score=best_score,
                details={"semantic_gain": semantic_gain},
            )
        if semantic_gain < 0.08:
            return GuardOutcome(
                passed=False,
                should_stop=True,
                reason="semantic_gain_too_low",
                score=best_score,
                details={"semantic_gain": semantic_gain},
            )
        return GuardOutcome(
            passed=True,
            should_stop=False,
            reason="ok",
            score=best_score,
            details={"semantic_gain": semantic_gain},
        )

