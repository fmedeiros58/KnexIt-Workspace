"""
FILE: orchestrator/hypothesis_pool.py
RESPONSIBILITY: Manage superposed hypotheses with readiness-aware permanence.
FLOW ROLE: Parallel hypothesis substrate before collapse.
READS: Candidates from resonance and contextual readiness controls.
RAM WRITES: Hypothesis map in RAM.
PERSISTS: Exportable for checkpoint/debug inspection.
PRIMARY RISK: Hypothesis explosion without pruning controls.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Dict, List

from anm_backend.audit import audit_log


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


@dataclass
class Hypothesis:
    """
    Objective:
        Hold one active reasoning candidate.
    Responsibilities:
        Track score/probability/cost/coherence for collapse decisions.
    Limits:
        No direct collapse policy.
    Mutates:
        score/probability/cost/coherence metadata.
    Must not:
        Bypass pool pruning rules.
    """

    hypothesis_id: str
    content: str
    score: float
    probability: float
    cost: float
    objective_fit: float
    origin_nodule: str = ""
    stimulus_coherence: float = 0.5
    metadata: Dict[str, object] = field(default_factory=dict)


@dataclass
class HypothesisPool:
    """
    Objective:
        Keep multiple candidate hypotheses alive in RAM.
    Responsibilities:
        Insert, update, prune and rank hypotheses.
    Limits:
        No LLM or resonance orchestration.
    Mutates:
        Internal hypothesis map.
    Must not:
        Perform final collapse.
    """

    max_size: int = 32
    hypotheses: Dict[str, Hypothesis] = field(default_factory=dict)

    def upsert(
        self,
        hypothesis: Hypothesis,
        *,
        readiness_score: float = 0.5,
        stimulus_coherence: float | None = None,
        trace_id: str | None = None,
    ) -> None:
        """
        Purpose:
            Insert/update hypothesis and apply readiness-aware permanence.
        Parameters:
            hypothesis: Hypothesis instance.
            readiness_score: Current readiness score [0..1].
            stimulus_coherence: Optional override for coherence.
            trace_id: Optional trace id.
        Returns:
            None.
        Side Effects:
            May evict weak hypothesis when over capacity.
        RAM Impact:
            Mutates pool map.
        Persistence Impact:
            Included in checkpoint/debug export.
        Expected Failures:
            None.
        """

        coherence = _clamp(stimulus_coherence if stimulus_coherence is not None else hypothesis.stimulus_coherence)
        hypothesis.stimulus_coherence = coherence
        hypothesis.metadata["readiness_score"] = _clamp(readiness_score)

        event_name = "hypothesis_updated" if hypothesis.hypothesis_id in self.hypotheses else "hypothesis_created"
        self.hypotheses[hypothesis.hypothesis_id] = hypothesis
        audit_log(
            component="orchestrator.hypothesis_pool",
            event=event_name,
            payload={
                "trace_id": trace_id,
                "hypothesis_id": hypothesis.hypothesis_id,
                "new_value": hypothesis.score,
                "stimulus_coherence": coherence,
                "readiness_score": readiness_score,
            },
            trace_id=trace_id,
        )

        self.prune(readiness_score=readiness_score, trace_id=trace_id)

    def update_score(self, hypothesis_id: str, delta: float, *, trace_id: str | None = None) -> None:
        hypothesis = self.hypotheses.get(hypothesis_id)
        if hypothesis is None:
            return
        previous = hypothesis.score
        hypothesis.score = max(0.0, hypothesis.score + delta)
        audit_log(
            component="orchestrator.hypothesis_pool",
            event="hypothesis_updated",
            payload={
                "trace_id": trace_id,
                "hypothesis_id": hypothesis_id,
                "previous_value": previous,
                "new_value": hypothesis.score,
                "reason": "score_delta",
            },
            trace_id=trace_id,
        )

    def prune(self, *, readiness_score: float, trace_id: str | None = None) -> List[str]:
        """
        Purpose:
            Prune weak hypotheses based on readiness and coherence.
        Parameters:
            readiness_score: Current readiness score.
            trace_id: Optional trace id.
        Returns:
            List[str]: Removed hypothesis ids.
        Side Effects:
            Removes weak/chaotic candidates.
        RAM Impact:
            Mutates hypothesis map.
        Persistence Impact:
            Included in snapshot.
        Expected Failures:
            None.
        """

        removed: List[str] = []
        if not self.hypotheses:
            return removed

        threshold = 0.12 + (0.35 * (1.0 - _clamp(readiness_score)))
        # FRAGILE/BLOCKED readiness produces stronger pruning.
        for hypothesis in list(self.hypotheses.values()):
            permanence = (
                (hypothesis.score * 0.45)
                + (hypothesis.probability * 0.2)
                + (hypothesis.objective_fit * 0.2)
                + (hypothesis.stimulus_coherence * 0.15)
                - (hypothesis.cost * 0.08)
            )
            if permanence >= threshold:
                continue
            removed.append(hypothesis.hypothesis_id)
            del self.hypotheses[hypothesis.hypothesis_id]
            audit_log(
                component="orchestrator.hypothesis_pool",
                event="hypothesis_removed",
                payload={
                    "trace_id": trace_id,
                    "hypothesis_id": hypothesis.hypothesis_id,
                    "reason": "low_permanence",
                    "previous_value": permanence,
                    "readiness_score": readiness_score,
                },
                trace_id=trace_id,
            )

        while len(self.hypotheses) > self.max_size:
            weakest = min(self.hypotheses.values(), key=lambda item: (item.score, item.stimulus_coherence, -item.cost))
            del self.hypotheses[weakest.hypothesis_id]
            removed.append(weakest.hypothesis_id)
            audit_log(
                component="orchestrator.hypothesis_pool",
                event="hypothesis_removed",
                payload={"trace_id": trace_id, "hypothesis_id": weakest.hypothesis_id, "reason": "max_size"},
                trace_id=trace_id,
            )
        return removed

    def active(self) -> List[Hypothesis]:
        return list(self.hypotheses.values())

    def top(self, k: int = 3) -> List[Hypothesis]:
        return sorted(
            self.hypotheses.values(),
            key=lambda item: (item.score, item.stimulus_coherence, item.probability, -item.cost),
            reverse=True,
        )[:k]

    def collapse_candidates(self, k: int = 3) -> List[Hypothesis]:
        return self.top(k=k)

    def clear(self) -> None:
        self.hypotheses.clear()

    def export_state(self) -> List[Dict[str, object]]:
        return [asdict(item) for item in self.hypotheses.values()]
