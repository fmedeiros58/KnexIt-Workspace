"""
FILE: anm/nodule.py
RESPONSIBILITY: Autonomous local micro-network with readiness-aware structural updates.
FLOW ROLE: Process local signals and emit output for orchestrator resonance flow.
READS: Input signal, regulatory metrics and synapse/neuron states.
RAM WRITES: Local neuron/synapse state and local readiness snapshot.
PERSISTS: Serializable local snapshot through checkpoint/debug layers.
PRIMARY RISK: If readiness gate is bypassed, noisy activation may become structural reinforcement.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List
from uuid import uuid4

from anm_backend.anm.neuron import Neuron
from anm_backend.anm.plasticity import PlasticityEngine
from anm_backend.anm.plasticity_readiness import PlasticityReadiness
from anm_backend.anm.synapse import Synapse
from anm_backend.audit import audit_log
from anm_backend.contracts import ReadinessSnapshot, ReadinessState


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


@dataclass
class Nodule:
    """
    Objective:
        Encapsulate one autonomous computational nodule.
    Responsibilities:
        Execute local network step and expose readiness-modulated output.
    Limits:
        No global scheduling or cross-nodule routing ownership.
    Mutates:
        Local neuron/synapse state and nodule memory-like local state.
    Must not:
        Call engine adapters or API directly.
    """

    nodule_id: str
    neurons: Dict[str, Neuron] = field(default_factory=dict)
    synapses: List[Synapse] = field(default_factory=list)
    plasticity: PlasticityEngine = field(default_factory=PlasticityEngine)
    plasticity_readiness: PlasticityReadiness = field(default_factory=PlasticityReadiness)
    local_state: Dict[str, Any] = field(default_factory=dict)
    local_memory: Dict[str, Any] = field(default_factory=dict)
    _last_input: float = 0.0
    _last_output: float = 0.0

    def receive_input(self, signal_strength: float, *, trace_id: str | None = None) -> None:
        """
        Purpose:
            Store incoming signal for next local step execution.
        Parameters:
            signal_strength: Input activation scalar.
            trace_id: Optional trace id.
        Returns:
            None.
        Side Effects:
            Updates local input state and emits audit log.
        RAM Impact:
            Mutates nodule local state.
        Persistence Impact:
            Included in nodule snapshots.
        Expected Failures:
            None.
        """

        self._last_input = max(0.0, float(signal_strength))
        self.local_state["last_input"] = self._last_input
        audit_log(
            component="anm.nodule",
            event="activation_received",
            payload={"trace_id": trace_id, "nodule_id": self.nodule_id, "new_value": self._last_input},
            trace_id=trace_id,
        )

    def step(
        self,
        *,
        stimulus_metrics: Dict[str, float],
        effective_learning_rate: float,
        allow_structural: bool,
        trace_id: str | None = None,
        cycle_id: int = 0,
    ) -> float:
        """
        Purpose:
            Execute one local nodule cycle with readiness-aware plasticity.
        Parameters:
            stimulus_metrics: Metrics consumed by local readiness module.
            effective_learning_rate: Learning-rate baseline from contextual gate.
            allow_structural: Whether structural updates are allowed this cycle.
            trace_id: Optional trace id.
            cycle_id: Current cycle id.
        Returns:
            float: Local output signal strength.
        Side Effects:
            Mutates neurons/synapses and local readiness state.
        RAM Impact:
            Critical nodule-local mutation.
        Persistence Impact:
            Captured by snapshots.
        Expected Failures:
            None.
        """

        if not self.neurons:
            self._last_output = 0.0
            return 0.0

        readiness = self.plasticity_readiness.compute(stimulus_metrics)
        readiness_score = readiness.readiness_score
        self.local_state["last_readiness"] = {
            "score": readiness.readiness_score,
            "state": readiness.readiness_state.value,
            "dominant_factors": list(readiness.dominant_factors),
        }

        outputs: Dict[str, float] = {}
        neuron_ids = list(self.neurons.keys())
        seed_id = neuron_ids[0]
        outputs[seed_id] = self.neurons[seed_id].stimulate(self._last_input)

        for synapse in self.synapses:
            pre_value = outputs.get(synapse.source_id, self.neurons.get(synapse.source_id, Neuron("tmp")).activation)
            influence = synapse.transmit(pre_value)
            target_neuron = self.neurons.get(synapse.target_id)
            if target_neuron is None:
                continue
            post_value = target_neuron.stimulate(influence)
            outputs[synapse.target_id] = post_value

            if allow_structural and readiness.readiness_state != ReadinessState.BLOCKED:
                # DECISION: learning-rate modulation is applied before synaptic updates.
                modulated_readiness = _clamp(readiness_score * min(1.0, effective_learning_rate / max(0.001, self.plasticity.learning_rate)))
                self.plasticity.apply_hebb(synapse, pre=pre_value, post=post_value, readiness_score=modulated_readiness)
                self.plasticity.apply_stdp(
                    synapse,
                    pre_spike_time=float(cycle_id),
                    post_spike_time=float(cycle_id) + max(0.0, post_value - pre_value),
                    readiness_score=modulated_readiness,
                )
            else:
                self.plasticity.apply_penalty(synapse, penalty=0.4, readiness_score=readiness_score)

        aggregate = sum(outputs.values()) / max(1, len(outputs))
        self._last_output = aggregate
        self.local_state["last_output"] = aggregate
        self.local_memory[f"cycle-{cycle_id}-{uuid4()}"] = {
            "output": aggregate,
            "readiness_score": readiness_score,
            "allow_structural": allow_structural,
        }
        if len(self.local_memory) > 64:
            oldest_key = next(iter(self.local_memory.keys()))
            del self.local_memory[oldest_key]

        audit_log(
            component="anm.nodule",
            event="nodule_fired",
            payload={
                "trace_id": trace_id,
                "cycle_id": cycle_id,
                "nodule_id": self.nodule_id,
                "new_value": aggregate,
                "readiness_score": readiness_score,
                "readiness_state": readiness.readiness_state.value,
                "allow_structural": allow_structural,
            },
            trace_id=trace_id,
        )
        return aggregate

    def expose_output(self) -> float:
        """
        Purpose:
            Return latest local output.
        Parameters:
            None.
        Returns:
            float: Last output signal.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return self._last_output

    def process(self, signal_strength: float) -> float:
        """
        Purpose:
            Backward-compatible one-shot local processing.
        Parameters:
            signal_strength: Input signal.
        Returns:
            float: Local output.
        Side Effects:
            Delegates to receive_input + step.
        RAM Impact:
            Delegated.
        Persistence Impact:
            Delegated.
        Expected Failures:
            None.
        """

        self.receive_input(signal_strength)
        return self.step(
            stimulus_metrics={
                "stimulus_quality": _clamp(signal_strength),
                "stimulus_consistency": 0.5,
                "stimulus_coherence": 0.5,
                "affective_safety": 0.6,
                "stress_load": 0.3,
                "context_stability": 0.6,
                "support_density": 0.5,
                "recovery_margin": 0.6,
            },
            effective_learning_rate=self.plasticity.learning_rate,
            allow_structural=True,
        )

    def readiness_snapshot(self) -> Dict[str, Any]:
        """
        Purpose:
            Export local readiness snapshot and history.
        Parameters:
            None.
        Returns:
            Dict[str, Any]: Readiness payload.
        Side Effects:
            None.
        RAM Impact:
            Temporary dict allocation.
        Persistence Impact:
            Snapshot can be checkpointed.
        Expected Failures:
            None.
        """

        return self.plasticity_readiness.export_snapshot()
