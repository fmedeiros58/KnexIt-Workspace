"""
FILE: anm/plasticity_readiness.py
RESPONSIBILITY: Compute computational plastic responsiveness before structural plasticity.
FLOW ROLE: Produces readiness score/state that modulate learning, pruning and consolidation.
READS: Regulatory metrics from memory/regulatory_state and local nodule signals.
RAM WRITES: Local readiness history cache.
PERSISTS: Snapshot exported through checkpoint/debug interfaces.
PRIMARY RISK: Oversimplified weighting may bias learning gates until tuned with data.
"""

from __future__ import annotations

from collections import deque
from dataclasses import asdict, dataclass, field
from threading import RLock
from typing import Any, Deque, Dict, List, Tuple

from anm_backend.audit import audit_log
from anm_backend.contracts import ReadinessSnapshot, ReadinessState


def _clamp(value: float) -> float:
    """
    Purpose:
        Clamp scalar into [0.0, 1.0].
    Parameters:
        value: Candidate value.
    Returns:
        float: Clamped scalar.
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
class PlasticityReadiness:
    """
    Objective:
        Estimate adaptive readiness to convert activation into useful structural change.
    Responsibilities:
        Compute readiness score, classify readiness state and keep short audit history.
    Limits:
        Does not directly mutate synapses/pathways.
    Mutates:
        Local readiness history cache.
    Must not:
        Be conflated with structural plasticity rules.
    """

    history_size: int = 24
    _history: Deque[ReadinessSnapshot] = field(default_factory=lambda: deque(maxlen=24))
    _lock: RLock = field(default_factory=RLock, repr=False)

    def compute(self, metrics: Dict[str, float]) -> ReadinessSnapshot:
        """
        Purpose:
            Compute readiness score/state from normalized runtime metrics.
        Parameters:
            metrics: Metric map with mandatory keys required by V2 model.
        Returns:
            ReadinessSnapshot: Computed readiness snapshot.
        Side Effects:
            Appends to local readiness history and emits audit log.
        RAM Impact:
            Mutates readiness history.
        Persistence Impact:
            Snapshot can be persisted by checkpoint layer.
        Expected Failures:
            KeyError if caller omits required metrics.
        """

        required = [
            "stimulus_quality",
            "stimulus_consistency",
            "stimulus_coherence",
            "affective_safety",
            "stress_load",
            "context_stability",
            "support_density",
            "recovery_margin",
        ]
        for key in required:
            if key not in metrics:
                raise KeyError(f"missing metric: {key}")

        quality = _clamp(float(metrics["stimulus_quality"]))
        consistency = _clamp(float(metrics["stimulus_consistency"]))
        coherence = _clamp(float(metrics["stimulus_coherence"]))
        safety = _clamp(float(metrics["affective_safety"]))
        stress = _clamp(float(metrics["stress_load"]))
        stability = _clamp(float(metrics["context_stability"]))
        support = _clamp(float(metrics["support_density"]))
        recovery = _clamp(float(metrics["recovery_margin"]))

        base = (
            (0.18 * quality)
            + (0.12 * consistency)
            + (0.14 * coherence)
            + (0.13 * safety)
            + (0.12 * stability)
            + (0.14 * support)
            + (0.17 * recovery)
        )
        penalty = (0.22 * stress) + (0.08 * max(0.0, stress - safety))
        alignment_bonus = 0.05 * (1.0 - abs(consistency - coherence))
        score = _clamp(base - penalty + alignment_bonus)

        # INVARIANT: high stress + low stability blocks structural readiness.
        if stress >= 0.78 and stability <= 0.32:
            score = min(score, 0.18)

        state = self._classify(score)
        dominant_factors = self._dominant_factors(
            quality=quality,
            consistency=consistency,
            coherence=coherence,
            safety=safety,
            stress=stress,
            stability=stability,
            support=support,
            recovery=recovery,
        )

        snapshot = ReadinessSnapshot(
            readiness_score=score,
            readiness_state=state,
            dominant_factors=dominant_factors,
            metrics={
                "stimulus_quality": quality,
                "stimulus_consistency": consistency,
                "stimulus_coherence": coherence,
                "affective_safety": safety,
                "stress_load": stress,
                "context_stability": stability,
                "support_density": support,
                "recovery_margin": recovery,
            },
        )

        with self._lock:
            if self._history.maxlen != self.history_size:
                self._history = deque(self._history, maxlen=self.history_size)
            self._history.append(snapshot)

        audit_log(
            component="anm.plasticity_readiness",
            event="plasticity_readiness_updated",
            payload={
                "readiness_score": snapshot.readiness_score,
                "readiness_state": snapshot.readiness_state.value,
                "dominant_factors": snapshot.dominant_factors,
                "stress_load": stress,
                "context_stability": stability,
            },
        )
        return snapshot

    def latest(self) -> ReadinessSnapshot | None:
        """
        Purpose:
            Return latest readiness snapshot if available.
        Parameters:
            None.
        Returns:
            ReadinessSnapshot | None: Last computed snapshot.
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
            return self._history[-1] if self._history else None

    def export_snapshot(self) -> Dict[str, Any]:
        """
        Purpose:
            Export serializable local readiness state.
        Parameters:
            None.
        Returns:
            Dict[str, Any]: Snapshot with latest and short history.
        Side Effects:
            None.
        RAM Impact:
            Temporary dict/list allocations.
        Persistence Impact:
            Can be included in checkpoints.
        Expected Failures:
            None.
        """

        with self._lock:
            latest = self._history[-1] if self._history else None
            history = [asdict(item) for item in self._history]
        return {
            "latest": asdict(latest) if latest else None,
            "history": history,
            "history_size": self.history_size,
        }

    def restore(self, payload: Dict[str, Any]) -> None:
        """
        Purpose:
            Restore local readiness history from serialized payload.
        Parameters:
            payload: Snapshot payload returned by export_snapshot.
        Returns:
            None.
        Side Effects:
            Replaces local readiness history.
        RAM Impact:
            Mutates local history deque.
        Persistence Impact:
            None directly.
        Expected Failures:
            ValueError for malformed states.
        """

        history_raw = payload.get("history", [])
        restored: Deque[ReadinessSnapshot] = deque(maxlen=self.history_size)
        for item in history_raw:
            if not isinstance(item, dict):
                continue
            state_value = str(item.get("readiness_state", ReadinessState.FRAGILE.value))
            restored.append(
                ReadinessSnapshot(
                    readiness_score=_clamp(float(item.get("readiness_score", 0.0))),
                    readiness_state=ReadinessState(state_value),
                    dominant_factors=list(item.get("dominant_factors", [])),
                    metrics={key: _clamp(float(value)) for key, value in dict(item.get("metrics", {})).items()},
                    timestamp=str(item.get("timestamp", "")),
                )
            )
        with self._lock:
            self._history = restored

    def _classify(self, score: float) -> ReadinessState:
        if score < 0.2:
            return ReadinessState.BLOCKED
        if score < 0.4:
            return ReadinessState.FRAGILE
        if score < 0.6:
            return ReadinessState.OPEN
        if score < 0.8:
            return ReadinessState.STABLE
        return ReadinessState.AMPLIFIED

    def _dominant_factors(
        self,
        *,
        quality: float,
        consistency: float,
        coherence: float,
        safety: float,
        stress: float,
        stability: float,
        support: float,
        recovery: float,
    ) -> List[str]:
        contributions: List[Tuple[str, float]] = [
            ("stimulus_quality", quality),
            ("stimulus_consistency", consistency),
            ("stimulus_coherence", coherence),
            ("affective_safety", safety),
            ("context_stability", stability),
            ("support_density", support),
            ("recovery_margin", recovery),
            ("stress_load", 1.0 - stress),
        ]
        contributions.sort(key=lambda pair: pair[1], reverse=True)
        return [name for name, _ in contributions[:3]]
