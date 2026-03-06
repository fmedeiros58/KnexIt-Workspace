"""
FILE: services/response_orchestration/semantic_controller_service.py
RESPONSIBILITY: Decide semantic direction for the next block generation.
FLOW ROLE: Keep discourse progression, continuity and anti-redundancy intent.
READS: Emission plan, session state and latest redundancy score.
RAM WRITES: None directly.
PERSISTS: None.
PRIMARY RISK: Incorrect direction can flatten argument progression.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from anm_backend.services.response_orchestration.types import EmissionPlan, SecondaryProcessMemoryState


@dataclass
class SemanticControlResult:
    next_intent: str
    semantic_direction: str
    continuity_rule: str
    redundancy_flags: List[str] = field(default_factory=list)


@dataclass
class SemanticControllerService:
    def decide(
        self,
        *,
        plan: EmissionPlan,
        session: SecondaryProcessMemoryState,
        cycle_index: int,
        redundancy_score: float,
    ) -> SemanticControlResult:
        pending = [item for item in session.pending_steps if str(item or "").strip()]
        next_intent = pending[0] if pending else "sintese_final"

        if not pending:
            semantic_direction = "concluir"
        elif redundancy_score >= 0.90:
            semantic_direction = "avancar_sem_repetir"
        elif cycle_index >= max(1, int(plan.max_cycles) - 1):
            semantic_direction = "consolidar"
        elif cycle_index == 1:
            semantic_direction = "introduzir_eixo"
        else:
            semantic_direction = "aprofundar_progressivamente"

        continuity_rule = (
            session.continuity_rule
            or session.join_rule
            or plan.phase0_join_rule
            or "manter sujeito principal e progressao sem reinicio"
        )
        redundancy_flags: List[str] = []
        if redundancy_score >= 0.90:
            redundancy_flags.append("high_redundancy_risk")
        if redundancy_score >= 0.97:
            redundancy_flags.append("critical_redundancy_risk")

        return SemanticControlResult(
            next_intent=str(next_intent),
            semantic_direction=semantic_direction,
            continuity_rule=str(continuity_rule),
            redundancy_flags=redundancy_flags,
        )
