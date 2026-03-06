"""
FILE: services/response_orchestration/response_critic_service.py
RESPONSIBILITY: Validate whether final answer addresses the prompt objective.
FLOW ROLE: Last gate before returning orchestrated response.
READS: Prompt and final response text.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Heuristic checks cannot fully replace semantic judgment.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _token_set(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]{3,}", _normalize(value).lower())}


@dataclass
class ResponseCheck:
    passed: bool
    score: float
    findings: List[str] = field(default_factory=list)


@dataclass
class ResponseCriticService:
    def evaluate(self, *, prompt_original: str, response_text: str) -> ResponseCheck:
        prompt_tokens = _token_set(prompt_original)
        response_tokens = _token_set(response_text)
        if not response_tokens:
            return ResponseCheck(passed=False, score=0.0, findings=["empty_response"])
        if not prompt_tokens:
            return ResponseCheck(passed=True, score=1.0, findings=["prompt_without_keywords"])

        overlap = float(len(prompt_tokens & response_tokens) / max(1, len(prompt_tokens)))
        findings: List[str] = []
        if overlap < 0.15:
            findings.append("low_prompt_alignment")
        if len(_normalize(response_text)) < 24:
            findings.append("response_too_short")
        passed = overlap >= 0.15 and "response_too_short" not in findings
        return ResponseCheck(passed=passed, score=overlap, findings=findings)
