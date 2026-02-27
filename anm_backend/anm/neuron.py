"""
FILE: anm/neuron.py
RESPONSIBILITY: Basic neuron dynamics for local ANM nodules.
FLOW ROLE: Elementary activation unit used by nodule micro-networks.
READS: Incoming stimulus and neuron threshold/decay state.
RAM WRITES: Activation, membrane potential and spike timestamps.
PERSISTS: Included indirectly via nodule checkpoint snapshots.
PRIMARY RISK: Misconfigured threshold/decay destabilizes nodule output.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class Neuron:
    """
    Objective:
        Model simplified neuron behavior for local processing.
    Responsibilities:
        Accumulate stimulus, evaluate threshold crossing and decay over time.
    Limits:
        No orchestration-level behavior.
    Mutates:
        Activation, potential and spike history.
    Must not:
        Own global routing or hypothesis policies.
    """

    neuron_id: str
    threshold: float = 0.6
    decay: float = 0.1
    activation: float = 0.0
    potential: float = 0.0
    spike_history: List[float] = field(default_factory=list)

    @property
    def id(self) -> str:
        """
        Purpose:
            Provide explicit `id` alias required by V2 contract.
        Parameters:
            None.
        Returns:
            str: Neuron id.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return self.neuron_id

    def receive_stimulus(self, stimulus: float) -> float:
        """
        Purpose:
            Integrate incoming stimulus into membrane potential.
        Parameters:
            stimulus: Incoming scalar signal.
        Returns:
            float: Current activation after stimulus integration.
        Side Effects:
            Mutates potential and activation.
        RAM Impact:
            Local neuron state mutation.
        Persistence Impact:
            Captured indirectly in nodule snapshot.
        Expected Failures:
            None.
        """

        self.potential = max(0.0, (self.potential * (1.0 - self.decay)) + max(0.0, stimulus))
        self.activation = self.potential
        return self.activation

    def should_fire(self) -> bool:
        """
        Purpose:
            Check whether neuron crosses threshold and should emit spike.
        Parameters:
            None.
        Returns:
            bool: True when neuron fires.
        Side Effects:
            Resets potential after firing and appends spike history marker.
        RAM Impact:
            Mutates local neuron state.
        Persistence Impact:
            Captured indirectly in nodule snapshot.
        Expected Failures:
            None.
        """

        fired = self.activation >= self.threshold
        if fired:
            self.spike_history.append(self.activation)
            self.potential = 0.0
            self.activation = 1.0
        else:
            self.activation = max(0.0, self.activation * (1.0 - self.decay))
        return fired

    def stimulate(self, value: float) -> float:
        """
        Purpose:
            Backward-compatible method returning binary spike output.
        Parameters:
            value: Input stimulation scalar.
        Returns:
            float: Output spike value (0.0 or 1.0).
        Side Effects:
            Delegates to receive_stimulus + should_fire.
        RAM Impact:
            Delegated mutation.
        Persistence Impact:
            Delegated.
        Expected Failures:
            None.
        """

        self.receive_stimulus(value)
        return 1.0 if self.should_fire() else 0.0
