"""
FILE: anm/plasticity.py
RESPONSIBILITY: Deterministic structural plasticity rules for synapses.
FLOW ROLE: Applies Hebbian and STDP-like updates after readiness gating.
READS: Pre/post activation, readiness score and synaptic state.
RAM WRITES: Synapse weight/priority/cost.
PERSISTS: Captured through checkpoint snapshots and structured logs.
PRIMARY RISK: Weight drift if readiness modulation is bypassed.
"""

from __future__ import annotations

from dataclasses import dataclass

from anm_backend.anm.synapse import Synapse
from anm_backend.audit import audit_log


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


@dataclass
class PlasticityEngine:
    """
    Objective:
        Encapsulate local deterministic learning updates.
    Responsibilities:
        Reinforce coherent pathways and weaken ineffective ones.
    Limits:
        No global orchestration or checkpoint responsibilities.
    Mutates:
        Synapse weight/priority/cost fields.
    Must not:
        Run without contextual readiness modulation.
    """

    learning_rate: float = 0.04
    stdp_rate: float = 0.03
    min_weight: float = 0.05
    max_weight: float = 2.0

    def apply_hebb(self, synapse: Synapse, pre: float, post: float, *, readiness_score: float = 1.0) -> float:
        """
        Purpose:
            Apply Hebbian reinforcement with readiness modulation.
        Parameters:
            synapse: Target synapse.
            pre: Pre-synaptic activation.
            post: Post-synaptic activation.
            readiness_score: Contextual readiness score [0..1].
        Returns:
            float: Updated synapse weight.
        Side Effects:
            Mutates synapse weight.
        RAM Impact:
            Structural mutation of local network.
        Persistence Impact:
            Included in checkpoint snapshots.
        Expected Failures:
            None.
        """

        effective_rate = self.learning_rate * _clamp(readiness_score, 0.0, 1.0)
        delta = effective_rate * max(0.0, pre) * max(0.0, post)
        previous = synapse.weight
        synapse.weight = _clamp(synapse.weight + delta, self.min_weight, self.max_weight)
        synapse.priority = _clamp(synapse.priority + (delta * 0.25), 0.05, 1.0)
        audit_log(
            component="anm.plasticity",
            event="synapse_hebb_updated",
            payload={
                "source_id": synapse.source_id,
                "target_id": synapse.target_id,
                "previous_value": previous,
                "new_value": synapse.weight,
                "readiness_score": readiness_score,
            },
        )
        return synapse.weight

    def apply_stdp(
        self,
        synapse: Synapse,
        *,
        pre_spike_time: float,
        post_spike_time: float,
        readiness_score: float = 1.0,
    ) -> float:
        """
        Purpose:
            Apply simplified STDP update with readiness modulation.
        Parameters:
            synapse: Target synapse.
            pre_spike_time: Pre-neuron spike timestamp-like scalar.
            post_spike_time: Post-neuron spike timestamp-like scalar.
            readiness_score: Contextual readiness score [0..1].
        Returns:
            float: Updated synapse weight.
        Side Effects:
            Mutates synapse weight and cost.
        RAM Impact:
            Structural mutation of local network.
        Persistence Impact:
            Included in checkpoint snapshots.
        Expected Failures:
            None.
        """

        readiness = _clamp(readiness_score, 0.0, 1.0)
        dt = post_spike_time - pre_spike_time
        polarity = 1.0 if dt >= 0 else -1.0
        magnitude = self.stdp_rate * readiness * (1.0 / (1.0 + abs(dt)))
        delta = magnitude * polarity
        previous = synapse.weight
        synapse.weight = _clamp(synapse.weight + delta, self.min_weight, self.max_weight)
        if polarity > 0:
            synapse.cost = _clamp(synapse.cost - (magnitude * 0.2), 0.1, 4.0)
        else:
            synapse.cost = _clamp(synapse.cost + (magnitude * 0.2), 0.1, 4.0)
        audit_log(
            component="anm.plasticity",
            event="synapse_stdp_updated",
            payload={
                "source_id": synapse.source_id,
                "target_id": synapse.target_id,
                "previous_value": previous,
                "new_value": synapse.weight,
                "dt": dt,
                "readiness_score": readiness,
            },
        )
        return synapse.weight

    def apply_penalty(self, synapse: Synapse, penalty: float, *, readiness_score: float = 1.0) -> float:
        """
        Purpose:
            Penalize ineffective synapses with readiness-aware scaling.
        Parameters:
            synapse: Target synapse.
            penalty: Penalty intensity.
            readiness_score: Contextual readiness score [0..1].
        Returns:
            float: Updated synapse weight.
        Side Effects:
            Mutates synapse weight and priority.
        RAM Impact:
            Structural mutation of local network.
        Persistence Impact:
            Included in checkpoint snapshots.
        Expected Failures:
            None.
        """

        readiness = _clamp(readiness_score, 0.0, 1.0)
        # Lower readiness increases pruning pressure as required by V2.
        effective_penalty = self.learning_rate * max(0.0, penalty) * (1.0 - readiness)
        previous = synapse.weight
        synapse.weight = _clamp(synapse.weight - effective_penalty, self.min_weight, self.max_weight)
        synapse.priority = _clamp(synapse.priority - (effective_penalty * 0.5), 0.05, 1.0)
        audit_log(
            component="anm.plasticity",
            event="synapse_penalized",
            payload={
                "source_id": synapse.source_id,
                "target_id": synapse.target_id,
                "previous_value": previous,
                "new_value": synapse.weight,
                "readiness_score": readiness,
            },
        )
        return synapse.weight
