"""
FILE: orchestrator/myelination_engine.py
RESPONSIBILITY: Functional reinforcement/weakening and decay of pathways.
FLOW ROLE: Maintain adaptive transport quality between nodules.
READS: Pathway feedback and current edge attributes.
RAM WRITES: Pathway weight/priority/cost/myelin.
PERSISTS: Captured via graph snapshots and logs.
PRIMARY RISK: Aggressive reinforcement can overfit routing topology.
"""

from __future__ import annotations

from dataclasses import dataclass

from anm_backend.audit import audit_log
from anm_backend.orchestrator.pathway_graph import PathwayGraph


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


@dataclass
class MyelinationEngine:
    """
    Objective:
        Maintain adaptive pathway quality.
    Responsibilities:
        Reinforce successful pathways, weaken failed ones and apply passive decay.
    Limits:
        No route selection ownership.
    Mutates:
        Pathway attributes in graph.
    Must not:
        Execute resonance scheduling.
    """

    reinforce_rate: float = 0.08
    weaken_rate: float = 0.06
    decay_rate: float = 0.01

    def reinforce(self, graph: PathwayGraph, source_id: str, target_id: str, reward: float, *, trace_id: str | None = None) -> None:
        edge = graph.get(source_id, target_id)
        if edge is None:
            return
        delta = self.reinforce_rate * max(0.0, reward)
        previous = edge.weight
        edge.weight = _clamp(edge.weight + delta, 0.05, 2.5)
        edge.priority = _clamp(edge.priority + (delta * 0.4), 0.05, 1.0)
        edge.cost = _clamp(edge.cost - (delta * 0.35), 0.1, 4.0)
        edge.myelin = _clamp(edge.myelin + (delta * 0.6), 0.0, 1.0)
        audit_log(
            component="orchestrator.myelination_engine",
            event="pathway_reinforced",
            payload={
                "trace_id": trace_id,
                "pathway_id": edge.pathway_id,
                "source_id": source_id,
                "target_id": target_id,
                "previous_value": previous,
                "new_value": edge.weight,
                "reason": "positive_feedback",
            },
            trace_id=trace_id,
        )

    def weaken(self, graph: PathwayGraph, source_id: str, target_id: str, penalty: float, *, trace_id: str | None = None) -> None:
        edge = graph.get(source_id, target_id)
        if edge is None:
            return
        delta = self.weaken_rate * max(0.0, penalty)
        previous = edge.weight
        edge.weight = _clamp(edge.weight - delta, 0.05, 2.5)
        edge.priority = _clamp(edge.priority - (delta * 0.4), 0.05, 1.0)
        edge.cost = _clamp(edge.cost + (delta * 0.4), 0.1, 4.0)
        edge.myelin = _clamp(edge.myelin - (delta * 0.6), 0.0, 1.0)
        audit_log(
            component="orchestrator.myelination_engine",
            event="pathway_weakened",
            payload={
                "trace_id": trace_id,
                "pathway_id": edge.pathway_id,
                "source_id": source_id,
                "target_id": target_id,
                "previous_value": previous,
                "new_value": edge.weight,
                "reason": "negative_feedback",
            },
            trace_id=trace_id,
        )

    def apply_decay(self, graph: PathwayGraph) -> None:
        """
        Purpose:
            Apply controlled passive decay across pathways.
        Parameters:
            graph: Pathway graph.
        Returns:
            None.
        Side Effects:
            Mutates pathway myelin and weight lightly.
        RAM Impact:
            Mutates graph edges.
        Persistence Impact:
            Included in checkpoint snapshots.
        Expected Failures:
            None.
        """

        for edge in graph.all_edges():
            edge.myelin = _clamp(edge.myelin - self.decay_rate, 0.0, 1.0)
            edge.weight = _clamp(edge.weight - (self.decay_rate * 0.2), 0.05, 2.5)
