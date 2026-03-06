"""
FILE: services/response_orchestration/turn_planner_service.py
RESPONSIBILITY: Decide role/function of the next conversational turn.
FLOW ROLE: Future conversational planning hook.
READS: Current intent and response validation signals.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Misclassification can produce wrong interaction style.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TurnFunction:
    function_name: str
    rationale: str


@dataclass
class TurnPlannerService:
    def plan_next_turn(self, *, response_check_passed: bool, next_intent: str) -> TurnFunction:
        if not response_check_passed:
            return TurnFunction(function_name="repair_or_clarify", rationale="response_check_failed")
        if str(next_intent or "").strip():
            return TurnFunction(function_name="continue_argument", rationale="next_intent_available")
        return TurnFunction(function_name="close_turn", rationale="intent_exhausted")
