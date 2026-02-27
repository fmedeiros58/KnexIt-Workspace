"""
FILE: anm/synapse.py
RESPONSIBILITY: Weighted directional connection between local neurons.
FLOW ROLE: Transmit signal from source neuron to target neuron.
READS: Source activation and synaptic parameters.
RAM WRITES: Weight/priority/cost changes by plasticity engine.
PERSISTS: Included in nodule and network checkpoints.
PRIMARY RISK: Unbounded weight/cost drift without controlled plasticity.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import uuid4


@dataclass
class Synapse:
    """
    Objective:
        Represent a local directional synaptic link.
    Responsibilities:
        Hold connection attributes and compute transmitted influence.
    Limits:
        No high-level orchestration.
    Mutates:
        Weight/priority/cost through plasticity.
    Must not:
        Decide cognitive outcomes.
    """

    source_id: str
    target_id: str
    weight: float = 0.5
    cost: float = 1.0
    priority: float = 0.5
    synapse_id: str = field(default_factory=lambda: f"syn-{uuid4()}")

    @property
    def id(self) -> str:
        """
        Purpose:
            Provide explicit `id` alias required by V2 contract.
        Parameters:
            None.
        Returns:
            str: Synapse id.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return self.synapse_id

    def transmit(self, source_activation: float) -> float:
        """
        Purpose:
            Compute transmitted signal from source activation.
        Parameters:
            source_activation: Source neuron activation.
        Returns:
            float: Transmitted influence.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        normalized_priority = max(0.05, min(1.0, self.priority))
        normalized_cost = max(0.1, self.cost)
        return max(0.0, source_activation) * self.weight * normalized_priority / normalized_cost

    def conduct(self, source_output: float) -> float:
        """
        Purpose:
            Backward-compatible alias for transmit().
        Parameters:
            source_output: Source output.
        Returns:
            float: Transmitted influence.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return self.transmit(source_output)
