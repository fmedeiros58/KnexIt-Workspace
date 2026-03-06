"""
FILE: services/response_orchestration/clarification_repair_manager_service.py
RESPONSIBILITY: Detect ambiguity and choose clarify-vs-assume strategy.
FLOW ROLE: Future conversational repair policy for uncertain requests.
READS: Prompt and current response quality cues.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Over-triggering clarification can harm conversational flow.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


@dataclass
class RepairStrategy:
    mode: str
    reason: str
    should_ask_clarification: bool


@dataclass
class ClarificationRepairManagerService:
    def decide(self, *, prompt_original: str) -> RepairStrategy:
        prompt = _normalize(prompt_original).lower()
        if not prompt:
            return RepairStrategy(mode="clarify", reason="empty_prompt", should_ask_clarification=True)
        if len(prompt.split()) <= 2:
            return RepairStrategy(mode="clarify", reason="very_short_prompt", should_ask_clarification=True)
        if re.search(r"\b(isso|aquilo|esse|essa|aquele|aquela)\b", prompt):
            return RepairStrategy(mode="clarify", reason="high_deictic_ambiguity", should_ask_clarification=True)
        return RepairStrategy(mode="assume_minimal_context", reason="sufficient_signal", should_ask_clarification=False)
