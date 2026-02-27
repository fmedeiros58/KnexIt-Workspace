"""
FILE: memory/memory_manager.py
RESPONSIBILITY: Master orchestrator for ANM memory subsystems (RAM-first).
FLOW ROLE: Coordinates ingestion, reinforcement, forgetting and consolidation gating.
READS: Observations, readiness gate decisions and memory policies.
RAM WRITES: Working/global/module/nodule memory plus central RAM cortex and regulatory state.
PERSISTS: Serializable snapshot payload consumed by checkpoint/persistence layers.
PRIMARY RISK: Cross-layer inconsistency if regulatory gate is bypassed.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional
from uuid import uuid4

from anm_backend.audit import audit_log
from anm_backend.contracts import HypothesisState, MemorySnapshot
from anm_backend.memory.forgetting_engine import ForgettingEngine
from anm_backend.memory.global_memory import GlobalMemory
from anm_backend.memory.memory_policies import MemoryPolicies
from anm_backend.memory.module_memory import ModuleMemory
from anm_backend.memory.nodule_memory import NoduleMemory
from anm_backend.memory.ram_cortex import RamCortex
from anm_backend.memory.regulatory_state import RegulatoryState
from anm_backend.memory.working_memory import WorkingItem, WorkingMemory
from anm_backend.orchestrator.contextual_plasticity_gate import ContextualGateDecision


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


@dataclass
class MemoryManager:
    """
    Objective:
        Provide unified lifecycle API across all memory layers.
    Responsibilities:
        Ingest observations, update regulatory state, reinforce and consolidate safely.
    Limits:
        Does not execute resonance or engine inference.
    Mutates:
        RAM memory surfaces and regulatory state.
    Must not:
        Treat persistence as primary cognition.
    """

    cortex: RamCortex
    working_memory: WorkingMemory
    global_memory: GlobalMemory
    module_memory: ModuleMemory
    nodule_memory: NoduleMemory
    policies: MemoryPolicies
    forgetting_engine: ForgettingEngine
    regulatory_state: RegulatoryState

    def ingest_observation(
        self,
        *,
        module_id: str,
        nodule_id: str,
        content: Dict[str, Any],
        salience: float,
        objective_fit: float,
        stimulus_quality: Optional[float] = None,
        support_density: Optional[float] = None,
        trace_id: Optional[str] = None,
    ) -> str:
        """
        Purpose:
            Ingest observation into live RAM cognition and regulatory state.
        Parameters:
            module_id: Source module identifier.
            nodule_id: Source nodule identifier.
            content: Observation payload.
            salience: Observation salience [0..1].
            objective_fit: Goal adherence [0..1].
            stimulus_quality: Optional explicit stimulus quality estimate.
            support_density: Optional support density estimate.
            trace_id: Optional trace id for audit correlation.
        Returns:
            str: Created working-memory item id.
        Side Effects:
            Mutates memory surfaces and emits structured logs.
        RAM Impact:
            Adds item to working/module/nodule/cortex states.
        Persistence Impact:
            None directly.
        Expected Failures:
            None.
        """

        item_id = f"wm-{uuid4()}"
        working_item = WorkingItem(item_id=item_id, content=content, salience=_clamp(salience))
        self.working_memory.push(working_item)
        self.module_memory.write(module_id, item_id, content)
        self.nodule_memory.write(nodule_id, item_id, content)
        self.cortex.update_context(item_id, content, source=f"{module_id}:{nodule_id}")
        self.cortex.set_activation(nodule_id=nodule_id, level=max(_clamp(salience), _clamp(objective_fit)), reason="ingest")

        inferred_quality = _clamp(stimulus_quality if stimulus_quality is not None else ((salience * 0.55) + (objective_fit * 0.45)))
        inferred_consistency = _clamp((self.regulatory_state.stimulus_consistency * 0.7) + (inferred_quality * 0.3))
        inferred_coherence = _clamp((objective_fit * 0.6) + (salience * 0.4))
        stress_delta = 0.06 if salience > 0.9 and inferred_coherence < 0.35 else -0.02
        self.regulatory_state.update_from_stimulus(
            stimulus_quality=inferred_quality,
            stimulus_consistency=inferred_consistency,
            stimulus_coherence=inferred_coherence,
            support_density=support_density,
            stress_delta=stress_delta,
        )
        self._sync_regulatory_to_cortex()

        audit_log(
            component="memory.memory_manager",
            event="ingest_observation",
            payload={
                "trace_id": trace_id,
                "item_id": item_id,
                "module_id": module_id,
                "nodule_id": nodule_id,
                "salience": salience,
                "objective_fit": objective_fit,
            },
            trace_id=trace_id,
        )
        return item_id

    def reinforce_item(
        self,
        item_id: str,
        *,
        module_id: str,
        score_delta: float = 0.1,
        gate_decision: ContextualGateDecision | None = None,
        trace_id: Optional[str] = None,
    ) -> None:
        """
        Purpose:
            Reinforce item salience and conditionally consolidate to global memory.
        Parameters:
            item_id: Working item identifier.
            module_id: Source module id.
            score_delta: Baseline reinforcement increment.
            gate_decision: Optional contextual gate decision.
            trace_id: Optional trace id for logs.
        Returns:
            None.
        Side Effects:
            Mutates working/global/module states based on readiness gate.
        RAM Impact:
            Salience updates and optional global consolidation.
        Persistence Impact:
            None directly.
        Expected Failures:
            None.
        """

        effective_delta = score_delta
        effective_consolidation_rate = 1.0
        allow_structural = True
        if gate_decision is not None:
            effective_delta = score_delta * max(0.05, gate_decision.readiness_score)
            effective_consolidation_rate = gate_decision.effective_consolidation_rate
            allow_structural = gate_decision.allow_structural_consolidation

        self.working_memory.bump(item_id, delta=effective_delta)
        content = self.module_memory.read(module_id, item_id, default={})
        score = self.policies.retention_score(
            salience=min(1.0, 0.5 + effective_delta),
            recurrence=min(1.0, 0.2 + effective_delta),
            objective_fit=0.7,
        )
        promote_threshold = self.policies.promote_threshold
        if gate_decision is not None:
            promote_threshold = min(0.95, self.policies.promote_threshold + (1.0 - effective_consolidation_rate) * 0.2)

        if allow_structural and not self.regulatory_state.should_block_structural_consolidation() and score >= promote_threshold:
            self.global_memory.write("semantic", item_id, content)
            audit_log(
                component="memory.memory_manager",
                event="memory_consolidated",
                payload={
                    "trace_id": trace_id,
                    "item_id": item_id,
                    "module_id": module_id,
                    "score": score,
                    "effective_consolidation_rate": effective_consolidation_rate,
                },
                trace_id=trace_id,
            )
        else:
            audit_log(
                component="memory.memory_manager",
                event="memory_consolidation_skipped",
                payload={
                    "trace_id": trace_id,
                    "item_id": item_id,
                    "score": score,
                    "allow_structural": allow_structural,
                    "blocked_by_safety": self.regulatory_state.should_block_structural_consolidation(),
                },
                trace_id=trace_id,
            )

    def register_hypothesis_state(
        self,
        *,
        hypothesis_id: str,
        summary: str,
        score: float,
        probability: float,
        cost: float,
        objective_fit: float,
        stimulus_coherence: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Purpose:
            Store hypothesis state in RAM cortex.
        Parameters:
            hypothesis_id: Hypothesis id.
            summary: Hypothesis summary.
            score: Hypothesis score.
            probability: Hypothesis probability.
            cost: Hypothesis cost.
            objective_fit: Objective-fit scalar.
            stimulus_coherence: Coherence scalar.
            metadata: Optional metadata.
        Returns:
            None.
        Side Effects:
            Mutates cortex active hypotheses.
        RAM Impact:
            Adds or updates hypothesis entry.
        Persistence Impact:
            Included in snapshot.
        Expected Failures:
            None.
        """

        self.cortex.register_hypothesis(
            HypothesisState(
                hypothesis_id=hypothesis_id,
                summary=summary,
                score=score,
                probability=probability,
                cost=cost,
                objective_fit=objective_fit,
                stimulus_coherence=stimulus_coherence,
                metadata=dict(metadata or {}),
            )
        )

    def remove_hypothesis(self, hypothesis_id: str, *, reason: str = "pruned") -> None:
        """
        Purpose:
            Remove one hypothesis from cortex.
        Parameters:
            hypothesis_id: Target id.
            reason: Removal reason.
        Returns:
            None.
        Side Effects:
            Mutates cortex hypothesis map.
        RAM Impact:
            Removes active hypothesis entry.
        Persistence Impact:
            Included in snapshots.
        Expected Failures:
            None.
        """

        self.cortex.remove_hypothesis(hypothesis_id, reason=reason)

    def assemble_prompt_context(self, limit: int = 10) -> Dict[str, Any]:
        """
        Purpose:
            Build prompt-ready live context.
        Parameters:
            limit: Max working items to include.
        Returns:
            Dict[str, Any]: Prompt context payload.
        Side Effects:
            None.
        RAM Impact:
            Temporary context allocation.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        working_items = self.working_memory.top(limit=limit)
        return {
            "working": [item.content for item in working_items],
            "global_semantic": self.global_memory.export_state().get("semantic", {}),
            "activation_map": dict(self.cortex.activation_map),
            "hot_index": dict(self.cortex.quick_index),
            "regulatory": self.regulatory_state.metrics(),
            "cycle_metadata": dict(self.cortex.cycle_metadata),
        }

    def run_forgetting_cycle(self) -> List[str]:
        """
        Purpose:
            Execute forgetting cycle and clean cortex noise.
        Parameters:
            None.
        Returns:
            List[str]: Removed working-memory item ids.
        Side Effects:
            Mutates working memory and cortex.
        RAM Impact:
            Removes low-retention items.
        Persistence Impact:
            None directly.
        Expected Failures:
            None.
        """

        removed = self.forgetting_engine.run(self.working_memory)
        self.cortex.clean_noise(min_activation=0.04, max_context_items=max(64, self.working_memory.capacity))
        return removed

    def snapshot(self) -> Dict[str, Any]:
        """
        Purpose:
            Export full serializable memory snapshot.
        Parameters:
            None.
        Returns:
            Dict[str, Any]: Composite snapshot payload.
        Side Effects:
            Emits audit log.
        RAM Impact:
            Temporary copy allocations.
        Persistence Impact:
            Payload consumed by checkpoint manager.
        Expected Failures:
            None.
        """

        payload = MemorySnapshot(
            cortex=self.cortex.snapshot(),
            working_memory=self.working_memory.export_state(),
            global_memory=self.global_memory.export_state(),
            module_memory=self.module_memory.export_state(),
            nodule_memory=self.nodule_memory.export_state(),
            regulatory_state=self.regulatory_state.snapshot(),
        )
        audit_log(
            component="memory.memory_manager",
            event="snapshot",
            payload={"working_items": len(payload.working_memory), "hypotheses": len(payload.cortex.get("active_hypotheses", {}))},
        )
        return asdict(payload)

    def restore(self, payload: Dict[str, Any]) -> None:
        """
        Purpose:
            Restore full memory state from snapshot.
        Parameters:
            payload: Composite snapshot payload.
        Returns:
            None.
        Side Effects:
            Replaces active memory state.
        RAM Impact:
            Overwrites managed memory surfaces.
        Persistence Impact:
            None directly.
        Expected Failures:
            Key/Type errors for malformed payload.
        """

        self.cortex.restore(payload.get("cortex", {}))
        self.working_memory.restore_state(payload.get("working_memory", []))
        self.global_memory.restore_state(payload.get("global_memory", {}))
        self.module_memory.restore_state(payload.get("module_memory", {}))
        self.nodule_memory.restore_state(payload.get("nodule_memory", {}))
        self.regulatory_state.restore(payload.get("regulatory_state", {}))
        self._sync_regulatory_to_cortex()
        audit_log(
            component="memory.memory_manager",
            event="restore",
            payload={"working_items": len(self.working_memory.export_state())},
        )

    def _sync_regulatory_to_cortex(self) -> None:
        """
        Purpose:
            Reflect regulatory summary in RAM cortex for downstream flow decisions.
        Parameters:
            None.
        Returns:
            None.
        Side Effects:
            Updates cortex regulatory summary.
        RAM Impact:
            Mutates cortex regulatory summary map.
        Persistence Impact:
            Included in snapshots.
        Expected Failures:
            None.
        """

        metrics = self.regulatory_state.metrics()
        self.cortex.set_regulatory_summary(
            {
                "stress_load": metrics["stress_load"],
                "context_stability": metrics["context_stability"],
                "support_density": metrics["support_density"],
                "recovery_margin": metrics["recovery_margin"],
                "affective_safety": metrics["affective_safety"],
            }
        )
