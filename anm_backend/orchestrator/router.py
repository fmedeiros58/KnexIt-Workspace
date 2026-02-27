"""
FILE: orchestrator/router.py
RESPONSIBILITY: Select next nodules for resonance propagation.
FLOW ROLE: Route decision module based on pathway and live context signals.
READS: Pathway graph, cortex activations, salience and optional context bias.
RAM WRITES: None directly.
PERSISTS: None.
PRIMARY RISK: Static scoring can reduce exploration diversity over time.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from anm_backend.contracts import RouteDecision
from anm_backend.memory.ram_cortex import RamCortex
from anm_backend.orchestrator.pathway_graph import Pathway, PathwayGraph


@dataclass
class Router:
    """
    Objective:
        Rank outgoing pathways for next resonance steps.
    Responsibilities:
        Score candidates using pathway quality and live cognitive context.
    Limits:
        No scheduling or state mutation.
    Mutates:
        None.
    Must not:
        Execute nodule steps.
    """

    max_fan_out: int = 3

    def score_pathway(self, edge: Pathway, cortex: RamCortex, *, context: Dict[str, float] | None = None) -> float:
        context = context or {}
        activation_bias = cortex.activation_map.get(edge.target_id, 0.2)
        salience_bias = float(cortex.quick_index.get(edge.target_id, 0)) / 10.0
        context_bias = float(context.get(edge.target_id, context.get("default", 0.0)))
        partial = (edge.weight * 0.40) + (edge.priority * 0.30) + (activation_bias * 0.15) + (salience_bias * 0.10)
        return partial + (context_bias * 0.10) - (edge.cost * 0.12)

    def route(
        self,
        source_id: str,
        graph: PathwayGraph,
        cortex: RamCortex,
        *,
        context: Dict[str, float] | None = None,
    ) -> List[RouteDecision]:
        candidates = graph.outgoing(source_id)
        decisions: List[RouteDecision] = []
        for edge in candidates:
            score = self.score_pathway(edge, cortex, context=context)
            decisions.append(
                RouteDecision(
                    target_id=edge.target_id,
                    score=score,
                    pathway_id=edge.pathway_id,
                    reason="weighted_route_score",
                    salience=float(cortex.quick_index.get(edge.target_id, 0)),
                    priority=edge.priority,
                )
            )
        decisions.sort(key=lambda item: item.score, reverse=True)
        return decisions[: self.max_fan_out]
