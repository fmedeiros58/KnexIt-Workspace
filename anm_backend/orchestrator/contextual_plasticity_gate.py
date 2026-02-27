"""
FILE: orchestrator/contextual_plasticity_gate.py
RESPONSIBILITY: Apply contextual readiness modulation before plasticity and consolidation.
FLOW ROLE: Mandatory gate between activation processing and structural updates.
READS: Readiness snapshots and regulatory state.
RAM WRITES: Gate decision traces for current cycle.
PERSISTS: Gate snapshots in checkpoints/debug payloads.
PRIMARY RISK: Over-restrictive gating can slow adaptation; under-gating can reinforce noise.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List

from anm_backend.audit import audit_log
from anm_backend.contracts import ReadinessSnapshot, ReadinessState, utc_now_iso
from anm_backend.memory.regulatory_state import RegulatoryState


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


@dataclass
class ContextualGateDecision:
    """
    Objective:
        Carry effective rates and limits after contextual modulation.
    Responsibilities:
        Expose deterministic parameters for memory/orchestrator/ANM stages.
    Limits:
        Value object only.
    Mutates:
        None after creation.
    Must not:
        Execute learning itself.
    """

    readiness_score: float
    readiness_state: ReadinessState
    effective_learning_rate: float
    effective_pruning_rate: float
    effective_consolidation_rate: float
    resonance_depth_limit: int
    hypothesis_keep_ratio: float
    allow_structural_consolidation: bool
    reason: str
    dominant_factors: List[str] = field(default_factory=list)
    timestamp: str = field(default_factory=utc_now_iso)


@dataclass
class ContextualPlasticityGate:
    """
    Objective:
        Modulate structural adaptation using computational plastic readiness.
    Responsibilities:
        Translate readiness into effective rates/limits used by runtime.
    Limits:
        Depends on external readiness computation.
    Mutates:
        Keeps latest decision for debug/inspection.
    Must not:
        Replace plasticity engine or memory manager.
    """

    base_learning_rate: float = 0.04
    base_pruning_rate: float = 0.06
    base_consolidation_rate: float = 0.1
    base_resonance_depth: int = 4
    min_resonance_depth: int = 1
    _latest: ContextualGateDecision | None = None

    def apply(self, readiness: ReadinessSnapshot, regulatory_state: RegulatoryState) -> ContextualGateDecision:
        """
        Purpose:
            Compute effective runtime modulation from readiness and regulatory safety.
        Parameters:
            readiness: Latest readiness snapshot.
            regulatory_state: Current regulatory state object.
        Returns:
            ContextualGateDecision: Effective rates and control decisions.
        Side Effects:
            Stores latest gate decision and emits audit log.
        RAM Impact:
            Updates gate-local decision state.
        Persistence Impact:
            Can be checkpointed/debugged via export method.
        Expected Failures:
            None.
        """

        readiness_score = _clamp(readiness.readiness_score)
        blocked_by_safety = regulatory_state.should_block_structural_consolidation()
        if blocked_by_safety:
            readiness_score = min(readiness_score, 0.2)

        effective_learning_rate = self.base_learning_rate * readiness_score
        effective_pruning_rate = self.base_pruning_rate * (1.0 - readiness_score)
        effective_consolidation_rate = self.base_consolidation_rate * readiness_score
        resonance_depth_limit = max(
            self.min_resonance_depth,
            int(round(self.base_resonance_depth * max(0.25, readiness_score))),
        )
        hypothesis_keep_ratio = max(0.15, readiness_score)

        allow_structural = readiness.readiness_state != ReadinessState.BLOCKED and not blocked_by_safety
        reason = "blocked_high_stress_low_stability" if blocked_by_safety else "readiness_modulated"

        decision = ContextualGateDecision(
            readiness_score=readiness_score,
            readiness_state=readiness.readiness_state,
            effective_learning_rate=effective_learning_rate,
            effective_pruning_rate=effective_pruning_rate,
            effective_consolidation_rate=effective_consolidation_rate,
            resonance_depth_limit=resonance_depth_limit,
            hypothesis_keep_ratio=hypothesis_keep_ratio,
            allow_structural_consolidation=allow_structural,
            reason=reason,
            dominant_factors=list(readiness.dominant_factors),
        )
        self._latest = decision

        audit_log(
            component="orchestrator.contextual_plasticity_gate",
            event="contextual_plasticity_gate_applied",
            payload={
                "readiness_score": decision.readiness_score,
                "readiness_state": decision.readiness_state.value,
                "effective_learning_rate": decision.effective_learning_rate,
                "effective_pruning_rate": decision.effective_pruning_rate,
                "effective_consolidation_rate": decision.effective_consolidation_rate,
                "resonance_depth_limit": decision.resonance_depth_limit,
                "allow_structural_consolidation": decision.allow_structural_consolidation,
                "reason": decision.reason,
                "dominant_factors": decision.dominant_factors,
            },
        )
        return decision

    def latest(self) -> ContextualGateDecision | None:
        """
        Purpose:
            Return latest gate decision.
        Parameters:
            None.
        Returns:
            ContextualGateDecision | None: Latest decision if available.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return self._latest

    def export_state(self) -> Dict[str, Any]:
        """
        Purpose:
            Export serializable gate state for debug/checkpoint.
        Parameters:
            None.
        Returns:
            Dict[str, Any]: Current decision state.
        Side Effects:
            None.
        RAM Impact:
            Temporary dict allocation.
        Persistence Impact:
            Can be included in snapshots.
        Expected Failures:
            None.
        """

        if self._latest is None:
            return {}
        payload = asdict(self._latest)
        payload["readiness_state"] = self._latest.readiness_state.value
        return payload
