"""
FILE: services/response_orchestration/chunk_orchestrator_service.py
RESPONSIBILITY: Expose explicit call plan from emission plan.
FLOW ROLE: Makes call orchestration decisions observable and auditable.
READS: EmissionPlan.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Divergence if this view is not kept in sync with planner behavior.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from anm_backend.services.response_orchestration.types import EmissionPlan


@dataclass
class ChunkOrchestratorService:
    def build_call_plan(self, *, plan: EmissionPlan) -> Dict[str, Any]:
        return {
            "response_mode": plan.response_mode,
            "call_count": int(plan.max_cycles),
            "min_cycles_required": int(plan.min_cycles_required),
            "target_chunk_tokens": int(plan.target_chunk_tokens),
            "max_total_response_tokens": int(plan.max_total_response_tokens),
            "planned_sections": list(plan.planned_sections),
            "phase0": {
                "enabled": bool(plan.phase0_enabled),
                "call_count": int(plan.phase0_call_count),
                "open_connector": plan.phase0_open_connector,
            },
            "rationale": list(plan.rationale),
        }

    def section_for_cycle(self, *, plan: EmissionPlan, cycle_index: int) -> str:
        idx = max(1, int(cycle_index)) - 1
        sections: List[str] = list(plan.planned_sections)
        if not sections:
            return "resposta_principal"
        if idx >= len(sections):
            return sections[-1]
        return sections[idx]
