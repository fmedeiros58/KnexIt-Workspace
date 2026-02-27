"""
FILE: services/cognitive_service.py
RESPONSIBILITY: Execute end-to-end cognitive turn outside API layer.
FLOW ROLE: Orchestrates memory -> readiness -> resonance -> collapse -> engine -> reinjection.
READS: Runtime components from main bootstrap.
RAM WRITES: Mutates memory, cortex, hypotheses and pathway adaptation state.
PERSISTS: Indirectly through memory persistence bridge/checkpoint.
PRIMARY RISK: Service drift can desynchronize API and cognitive runtime behavior.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict
from uuid import uuid4

from anm_backend.adapters.llm_adapter import LLMAdapter
from anm_backend.anm.plasticity_readiness import PlasticityReadiness
from anm_backend.audit import audit_log
from anm_backend.memory.memory_manager import MemoryManager
from anm_backend.memory.regulatory_state import RegulatoryState
from anm_backend.orchestrator.collapse_engine import CollapseEngine
from anm_backend.orchestrator.contextual_plasticity_gate import ContextualPlasticityGate
from anm_backend.orchestrator.hypothesis_pool import Hypothesis, HypothesisPool
from anm_backend.orchestrator.myelination_engine import MyelinationEngine
from anm_backend.orchestrator.pathway_graph import PathwayGraph
from anm_backend.orchestrator.resonance_engine import ResonanceEngine


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


@dataclass
class CognitiveService:
    """
    Objective:
        Provide one executable cognitive turn pipeline.
    Responsibilities:
        Run readiness modulation before structural updates and consolidation.
    Limits:
        No HTTP concerns.
    Mutates:
        Runtime cognitive state.
    Must not:
        Hide critical flow side effects.
    """

    memory_manager: MemoryManager
    resonance_engine: ResonanceEngine
    hypothesis_pool: HypothesisPool
    collapse_engine: CollapseEngine
    llm_adapter: LLMAdapter
    plasticity_readiness: PlasticityReadiness
    regulatory_state: RegulatoryState
    contextual_gate: ContextualPlasticityGate
    graph: PathwayGraph
    myelination_engine: MyelinationEngine

    def run_chat_turn(self, message: str) -> Dict[str, Any]:
        """
        Purpose:
            Execute one complete chat-driven cognitive cycle.
        Parameters:
            message: User input text.
        Returns:
            Dict[str, Any]: Structured response payload.
        Side Effects:
            Mutates live RAM cognition and emits audit logs.
        RAM Impact:
            End-to-end mutation in memory, hypotheses and pathway graph.
        Persistence Impact:
            None directly.
        Expected Failures:
            RuntimeError from engine invocation path.
        """

        trace_id = f"trace-{uuid4()}"
        msg = message.strip()
        if not msg:
            raise ValueError("message is required")

        self.hypothesis_pool.clear()
        message_quality = _clamp(min(1.0, 0.2 + (len(msg) / 240.0)))
        self.memory_manager.ingest_observation(
            module_id="chat",
            nodule_id="language_nodule",
            content={"role": "user", "text": msg},
            salience=0.78,
            objective_fit=0.88,
            stimulus_quality=message_quality,
            support_density=0.62,
            trace_id=trace_id,
        )

        metrics = self.regulatory_state.metrics(stimulus_quality=message_quality)
        readiness = self.plasticity_readiness.compute(metrics)
        self.regulatory_state.register_readiness(
            readiness.readiness_score,
            readiness.readiness_state,
            dominant_factors=readiness.dominant_factors,
        )
        gate_decision = self.contextual_gate.apply(readiness, self.regulatory_state)

        hypotheses = self.resonance_engine.run(
            seed_nodule_id="language_nodule",
            seed_strength=0.9,
            cortex=self.memory_manager.cortex,
            hypothesis_pool=self.hypothesis_pool,
            gate_decision=gate_decision,
            trace_id=trace_id,
            stimulus_metrics=metrics,
        )
        candidates = hypotheses or self.hypothesis_pool.collapse_candidates(k=3)
        collapsed = self.collapse_engine.collapse(candidates, trace_id=trace_id) if candidates else Hypothesis(
            hypothesis_id="fallback",
            content="fallback hypothesis",
            score=0.2,
            probability=0.5,
            cost=1.0,
            objective_fit=0.5,
            origin_nodule="language_nodule",
            stimulus_coherence=metrics["stimulus_coherence"],
        )

        self.memory_manager.register_hypothesis_state(
            hypothesis_id=collapsed.hypothesis_id,
            summary=collapsed.content,
            score=collapsed.score,
            probability=collapsed.probability,
            cost=collapsed.cost,
            objective_fit=collapsed.objective_fit,
            stimulus_coherence=collapsed.stimulus_coherence,
            metadata={"origin_nodule": collapsed.origin_nodule},
        )

        context = self.memory_manager.assemble_prompt_context(limit=10)
        response = self.llm_adapter.infer(
            user_input=msg,
            context=context,
            hypotheses=[collapsed],
            readiness_state=readiness.readiness_state.value,
            max_tokens=int(os.getenv("ANM_CHAT_MAX_TOKENS", "128")),
            trace_id=trace_id,
        )
        answer = response.text.strip()
        assistant_item_id = self.memory_manager.ingest_observation(
            module_id="chat",
            nodule_id="language_nodule",
            content={"role": "assistant", "text": answer},
            salience=0.66,
            objective_fit=0.82,
            stimulus_quality=_clamp(collapsed.objective_fit),
            support_density=_clamp(0.55 + collapsed.stimulus_coherence * 0.2),
            trace_id=trace_id,
        )

        self.memory_manager.reinforce_item(
            item_id=assistant_item_id,
            module_id="chat",
            score_delta=0.08,
            gate_decision=gate_decision,
            trace_id=trace_id,
        )
        self.memory_manager.run_forgetting_cycle()
        if answer:
            self.myelination_engine.reinforce(self.graph, "language_nodule", "planner_nodule", reward=collapsed.score, trace_id=trace_id)
        else:
            self.myelination_engine.weaken(self.graph, "language_nodule", "planner_nodule", penalty=0.7, trace_id=trace_id)

        audit_log(
            component="services.cognitive_service",
            event="chat_turn_completed",
            payload={
                "trace_id": trace_id,
                "hypothesis_id": collapsed.hypothesis_id,
                "readiness_score": readiness.readiness_score,
                "readiness_state": readiness.readiness_state.value,
                "answer_length": len(answer),
            },
            trace_id=trace_id,
        )
        return {
            "trace_id": trace_id,
            "answer": answer,
            "collapsed_hypothesis": {
                "id": collapsed.hypothesis_id,
                "score": collapsed.score,
                "origin_nodule": collapsed.origin_nodule,
                "stimulus_coherence": collapsed.stimulus_coherence,
            },
            "readiness": {
                "score": readiness.readiness_score,
                "state": readiness.readiness_state.value,
                "dominant_factors": readiness.dominant_factors,
            },
            "regulatory_state": {
                "stress_load": self.regulatory_state.stress_load,
                "context_stability": self.regulatory_state.context_stability,
            },
            "engine": {"model": response.model, "usage": response.usage},
        }
