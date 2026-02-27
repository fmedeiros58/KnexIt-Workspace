"""
FILE: memory/regulatory_state.py
RESPONSIBILITY: Maintain short-horizon regulatory variables that modulate plastic readiness.
FLOW ROLE: Pre-plasticity regulation layer feeding readiness and contextual gate.
READS: Stimulus metrics and runtime feedback from memory/orchestrator.
RAM WRITES: Regulatory variables and readiness history in RAM.
PERSISTS: Serializable snapshot through memory manager checkpoints.
PRIMARY RISK: Unstable heuristics can over-block learning if thresholds are mis-tuned.
"""

from __future__ import annotations

from collections import deque
from dataclasses import asdict, dataclass, field
from threading import RLock
from typing import Any, Deque, Dict, List

from anm_backend.audit import audit_log
from anm_backend.contracts import ReadinessState, RegulatoryStateSnapshot, utc_now_iso


def _clamp(value: float) -> float:
    """
    Purpose:
        Clamp scalar into the [0.0, 1.0] interval.
    Parameters:
        value: Scalar value.
    Returns:
        float: Clamped value.
    Side Effects:
        None.
    RAM Impact:
        None.
    Persistence Impact:
        None.
    Expected Failures:
        None.
    """

    return max(0.0, min(1.0, value))


@dataclass
class RegulatoryState:
    """
    Objective:
        Hold adaptive readiness prerequisites before structural plasticity.
    Responsibilities:
        Track stress/stability/support/recovery and readiness trend history.
    Limits:
        Does not mutate synapses or pathways directly.
    Mutates:
        Regulatory variables in live RAM.
    Must not:
        Be treated as equivalent to structural plasticity.
    """

    stress_load: float = 0.25
    context_stability: float = 0.6
    support_density: float = 0.55
    recovery_margin: float = 0.7
    affective_safety: float = 0.7
    stimulus_consistency: float = 0.5
    stimulus_coherence: float = 0.5
    readiness_history_size: int = 24
    readiness_history: Deque[Dict[str, Any]] = field(default_factory=lambda: deque(maxlen=24))
    _lock: RLock = field(default_factory=RLock, repr=False)

    def update_from_stimulus(
        self,
        *,
        stimulus_quality: float,
        stimulus_consistency: float,
        stimulus_coherence: float,
        support_density: float | None = None,
        stress_delta: float = 0.0,
    ) -> None:
        """
        Purpose:
            Update regulatory variables from current input quality/coherence.
        Parameters:
            stimulus_quality: Semantic quality/relevance of current input.
            stimulus_consistency: Recurrence/consistency estimate for stimulus stream.
            stimulus_coherence: Coherence against active context and hypothesis.
            support_density: Optional explicit support density update.
            stress_delta: Signed stress adjustment caused by contention/noise.
        Returns:
            None.
        Side Effects:
            Emits structured audit event.
        RAM Impact:
            Mutates short-term regulatory state.
        Persistence Impact:
            Included on next checkpoint snapshot.
        Expected Failures:
            None.
        """

        with self._lock:
            self.stimulus_consistency = _clamp((self.stimulus_consistency * 0.65) + (stimulus_consistency * 0.35))
            self.stimulus_coherence = _clamp((self.stimulus_coherence * 0.6) + (stimulus_coherence * 0.4))
            self.context_stability = _clamp((self.context_stability * 0.65) + (stimulus_quality * 0.35))
            if support_density is not None:
                self.support_density = _clamp((self.support_density * 0.6) + (support_density * 0.4))

            instability = max(0.0, 1.0 - self.context_stability)
            coherence_boost = max(0.0, self.stimulus_coherence - 0.5)
            self.stress_load = _clamp(self.stress_load + stress_delta + (instability * 0.12) - (coherence_boost * 0.08))
            self.affective_safety = _clamp((1.0 - self.stress_load) * 0.6 + self.context_stability * 0.4)
            self.recovery_margin = _clamp((self.recovery_margin * 0.6) + (self.affective_safety * 0.2) + ((1.0 - self.stress_load) * 0.2))

        audit_log(
            component="memory.regulatory_state",
            event="regulatory_state_updated",
            payload={
                "stress_load": self.stress_load,
                "context_stability": self.context_stability,
                "support_density": self.support_density,
                "stimulus_consistency": self.stimulus_consistency,
                "stimulus_coherence": self.stimulus_coherence,
            },
        )

    def register_readiness(self, readiness_score: float, readiness_state: ReadinessState, *, dominant_factors: List[str]) -> None:
        """
        Purpose:
            Store one readiness sample in short history for audit and modulation.
        Parameters:
            readiness_score: Computed readiness score [0..1].
            readiness_state: Computed categorical readiness state.
            dominant_factors: Main factors that influenced the score.
        Returns:
            None.
        Side Effects:
            Appends readiness history entry and emits audit log.
        RAM Impact:
            Mutates readiness history deque.
        Persistence Impact:
            History summary is checkpointed.
        Expected Failures:
            None.
        """

        with self._lock:
            entry = {
                "timestamp": utc_now_iso(),
                "readiness_score": _clamp(readiness_score),
                "readiness_state": readiness_state.value,
                "dominant_factors": list(dominant_factors),
            }
            if self.readiness_history.maxlen != self.readiness_history_size:
                self.readiness_history = deque(self.readiness_history, maxlen=self.readiness_history_size)
            self.readiness_history.append(entry)

        audit_log(
            component="memory.regulatory_state",
            event="plasticity_readiness_updated",
            payload={
                "readiness_score": entry["readiness_score"],
                "readiness_state": entry["readiness_state"],
                "dominant_factors": entry["dominant_factors"],
            },
        )

    def should_block_structural_consolidation(self) -> bool:
        """
        Purpose:
            Apply mandatory safety rule for consolidation blocking.
        Parameters:
            None.
        Returns:
            bool: True when processing must avoid structural consolidation.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        with self._lock:
            return self.stress_load >= 0.78 and self.context_stability <= 0.32

    def readiness_trend(self) -> float:
        """
        Purpose:
            Estimate readiness trend over short history.
        Parameters:
            None.
        Returns:
            float: Signed trend in [-1.0, 1.0].
        Side Effects:
            None.
        RAM Impact:
            Temporary list allocation.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        with self._lock:
            scores = [float(item.get("readiness_score", 0.0)) for item in self.readiness_history]
        if len(scores) < 2:
            return 0.0
        return max(-1.0, min(1.0, scores[-1] - scores[0]))

    def metrics(self, *, stimulus_quality: float = 0.5) -> Dict[str, float]:
        """
        Purpose:
            Export normalized metrics consumed by readiness computation.
        Parameters:
            stimulus_quality: Current semantic quality estimate.
        Returns:
            Dict[str, float]: Metric map used by readiness engine.
        Side Effects:
            None.
        RAM Impact:
            Temporary dictionary allocation.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        with self._lock:
            return {
                "stimulus_quality": _clamp(stimulus_quality),
                "stimulus_consistency": self.stimulus_consistency,
                "stimulus_coherence": self.stimulus_coherence,
                "affective_safety": self.affective_safety,
                "stress_load": self.stress_load,
                "context_stability": self.context_stability,
                "support_density": self.support_density,
                "recovery_margin": self.recovery_margin,
            }

    def snapshot(self) -> Dict[str, Any]:
        """
        Purpose:
            Export serializable regulatory state snapshot.
        Parameters:
            None.
        Returns:
            Dict[str, Any]: Serialized regulatory state.
        Side Effects:
            None.
        RAM Impact:
            Temporary snapshot allocation.
        Persistence Impact:
            Intended for checkpoint save.
        Expected Failures:
            None.
        """

        with self._lock:
            snapshot = RegulatoryStateSnapshot(
                stress_load=self.stress_load,
                context_stability=self.context_stability,
                support_density=self.support_density,
                recovery_margin=self.recovery_margin,
                affective_safety=self.affective_safety,
                stimulus_consistency=self.stimulus_consistency,
                stimulus_coherence=self.stimulus_coherence,
                readiness_history=list(self.readiness_history),
            )
        return asdict(snapshot)

    def restore(self, payload: Dict[str, Any]) -> None:
        """
        Purpose:
            Restore regulatory state from checkpoint payload.
        Parameters:
            payload: Serialized regulatory snapshot.
        Returns:
            None.
        Side Effects:
            Replaces current regulatory variables and history.
        RAM Impact:
            Critical replacement of regulatory state.
        Persistence Impact:
            None directly.
        Expected Failures:
            TypeError/ValueError for malformed payload.
        """

        with self._lock:
            self.stress_load = _clamp(float(payload.get("stress_load", self.stress_load)))
            self.context_stability = _clamp(float(payload.get("context_stability", self.context_stability)))
            self.support_density = _clamp(float(payload.get("support_density", self.support_density)))
            self.recovery_margin = _clamp(float(payload.get("recovery_margin", self.recovery_margin)))
            self.affective_safety = _clamp(float(payload.get("affective_safety", self.affective_safety)))
            self.stimulus_consistency = _clamp(float(payload.get("stimulus_consistency", self.stimulus_consistency)))
            self.stimulus_coherence = _clamp(float(payload.get("stimulus_coherence", self.stimulus_coherence)))
            history = payload.get("readiness_history", [])
            self.readiness_history = deque(list(history)[-self.readiness_history_size :], maxlen=self.readiness_history_size)

        audit_log(
            component="memory.regulatory_state",
            event="regulatory_state_restored",
            payload={
                "stress_load": self.stress_load,
                "context_stability": self.context_stability,
                "readiness_history": len(self.readiness_history),
            },
        )
