"""
FILE: orchestrator/collapse_engine.py
RESPONSIBILITY: Collapse superposition into one actionable hypothesis.
FLOW ROLE: Final selection/fusion stage after resonance exploration.
READS: Ranked hypotheses from hypothesis pool.
RAM WRITES: None directly (returns collapsed hypothesis).
PERSISTS: Collapse events logged for audit.
PRIMARY RISK: Premature collapse can remove useful diversity.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from anm_backend.audit import audit_log
from anm_backend.orchestrator.hypothesis_pool import Hypothesis


@dataclass
class CollapseEngine:
    """
    Objective:
        Transform hypothesis set into one final candidate.
    Responsibilities:
        Apply deterministic collapse strategy.
    Limits:
        Requires upstream quality scoring.
    Mutates:
        None outside returned object.
    Must not:
        Re-run resonance.
    """

    mode: str = "fuse_top2"

    def collapse(self, candidates: List[Hypothesis], *, trace_id: str | None = None) -> Hypothesis:
        if not candidates:
            raise ValueError("no hypotheses available for collapse")

        if self.mode == "best" or len(candidates) == 1:
            winner = candidates[0]
            audit_log(
                component="orchestrator.collapse_engine",
                event="hypothesis_collapsed",
                payload={
                    "trace_id": trace_id,
                    "hypothesis_id": winner.hypothesis_id,
                    "new_value": winner.score,
                    "reason": "best",
                },
                trace_id=trace_id,
            )
            return winner

        first, second = candidates[0], candidates[1]
        fused = Hypothesis(
            hypothesis_id=f"fused-{first.hypothesis_id}-{second.hypothesis_id}",
            content=f"{first.content}\n\n[merge]\n{second.content}",
            score=(first.score * 0.62) + (second.score * 0.38),
            probability=(first.probability + second.probability) / 2.0,
            cost=(first.cost + second.cost) / 2.0,
            objective_fit=max(first.objective_fit, second.objective_fit),
            origin_nodule=f"{first.origin_nodule}|{second.origin_nodule}",
            stimulus_coherence=max(first.stimulus_coherence, second.stimulus_coherence),
        )
        audit_log(
            component="orchestrator.collapse_engine",
            event="hypothesis_collapsed",
            payload={
                "trace_id": trace_id,
                "hypothesis_id": fused.hypothesis_id,
                "new_value": fused.score,
                "reason": "fused_top2",
            },
            trace_id=trace_id,
        )
        return fused
