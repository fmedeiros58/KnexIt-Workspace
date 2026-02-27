"""
FILE: orchestrator/nodule_registry.py
RESPONSIBILITY: Register, validate and resolve autonomous nodules.
FLOW ROLE: First orchestration layer for nodule discovery.
READS: Nodule registration metadata and lookup requests.
RAM WRITES: Active registry and capability indexes.
PERSISTS: Exportable inventory for debug/checkpoint.
PRIMARY RISK: Invalid nodule registration can break resonance cycles.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, Optional

from anm_backend.anm.nodule import Nodule
from anm_backend.audit import audit_log


@dataclass
class NoduleRegistry:
    """
    Objective:
        Maintain valid catalog of autonomous nodules.
    Responsibilities:
        Register, validate, fetch and list nodules.
    Limits:
        No routing or scheduling.
    Mutates:
        Registry dictionaries.
    Must not:
        Execute nodule processing logic itself.
    """

    _nodules: Dict[str, Nodule] = field(default_factory=dict)
    _capabilities: Dict[str, Dict[str, float]] = field(default_factory=dict)

    def validate(self, nodule: Nodule) -> bool:
        """
        Purpose:
            Validate minimal nodule structure required for runtime.
        Parameters:
            nodule: Candidate nodule.
        Returns:
            bool: True when nodule is valid.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        if not nodule.nodule_id.strip():
            return False
        if not isinstance(nodule.neurons, dict):
            return False
        return True

    def register(self, nodule: Nodule, capabilities: Optional[Dict[str, float]] = None) -> None:
        """
        Purpose:
            Register validated nodule instance.
        Parameters:
            nodule: Nodule instance.
            capabilities: Optional capability scores.
        Returns:
            None.
        Side Effects:
            Emits audit event.
        RAM Impact:
            Mutates registry and capability maps.
        Persistence Impact:
            Included via debug/checkpoint exports.
        Expected Failures:
            ValueError when nodule is invalid.
        """

        if not self.validate(nodule):
            raise ValueError(f"invalid nodule: {nodule.nodule_id}")
        self._nodules[nodule.nodule_id] = nodule
        self._capabilities[nodule.nodule_id] = dict(capabilities or {})
        audit_log(
            component="orchestrator.nodule_registry",
            event="nodule_registered",
            payload={"nodule_id": nodule.nodule_id, "capabilities": self._capabilities[nodule.nodule_id]},
        )

    def get(self, nodule_id: str) -> Optional[Nodule]:
        return self._nodules.get(nodule_id)

    def list_ids(self) -> Iterable[str]:
        return self._nodules.keys()

    def list_nodules(self) -> Dict[str, Nodule]:
        return dict(self._nodules)

    def capabilities(self, nodule_id: str) -> Dict[str, float]:
        return dict(self._capabilities.get(nodule_id, {}))
