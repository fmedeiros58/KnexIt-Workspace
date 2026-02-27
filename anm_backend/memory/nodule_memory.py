"""
FILE: memory/nodule_memory.py
RESPONSIBILITY: Fine-grained per-nodule memory and local learning traces in RAM.
FLOW ROLE: Provides local state for autonomous nodules and plasticity updates.
READS: Nodule-level activations, spikes and feedback.
RAM WRITES: Per-nodule state maps and local metrics.
PERSISTS: Checkpoint snapshots only.
PRIMARY RISK: Memory fragmentation if stale nodule state is never pruned.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict

from anm_backend.audit import audit_log


@dataclass
class NoduleMemory:
    """
    Objective:
        Keep local memory states for autonomous nodules.
    Responsibilities:
        Track local priming, weights, spike summaries and per-nodule value.
    Limits:
        Not responsible for global routing decisions.
    Mutates:
        Per-nodule maps in RAM.
    Must not:
        Persist itself directly without checkpoint manager.
    """

    nodules: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def write(self, nodule_id: str, key: str, value: Any) -> None:
        """
        Purpose:
            Upsert a local nodule memory value.
        Parameters:
            nodule_id: Nodule identifier.
            key: Local key.
            value: Local value.
        Returns:
            None.
        Side Effects:
            Emits AUDIT log.
        RAM Impact:
            Mutates nodule-local map.
        Persistence Impact:
            Captured only in checkpoint snapshots.
        Expected Failures:
            None.
        """

        bucket = self.nodules.setdefault(nodule_id, {})
        bucket[key] = value
        # AUDIT: nodule-local memory mutation.
        audit_log(
            component="memory.nodule_memory",
            event="write",
            payload={"nodule_id": nodule_id, "key": key},
        )

    def read(self, nodule_id: str, key: str, default: Any = None) -> Any:
        """
        Purpose:
            Read local memory value for nodule.
        Parameters:
            nodule_id: Nodule identifier.
            key: Local key.
            default: Fallback value.
        Returns:
            Any: Stored value or fallback.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return self.nodules.get(nodule_id, {}).get(key, default)

    def export_state(self) -> Dict[str, Dict[str, Any]]:
        """
        Purpose:
            Export nodule-memory snapshot.
        Parameters:
            None.
        Returns:
            Dict[str, Dict[str, Any]]: Copy of nodule-local maps.
        Side Effects:
            None.
        RAM Impact:
            Temporary copy allocation.
        Persistence Impact:
            Intended for checkpoint serialization.
        Expected Failures:
            None.
        """

        return {nodule_id: dict(values) for nodule_id, values in self.nodules.items()}

    def restore_state(self, payload: Dict[str, Dict[str, Any]]) -> None:
        """
        Purpose:
            Restore local nodule memory from snapshot payload.
        Parameters:
            payload: Serialized nodule memory payload.
        Returns:
            None.
        Side Effects:
            Replaces local map in RAM.
        RAM Impact:
            Full replacement of nodule-local state.
        Persistence Impact:
            None directly.
        Expected Failures:
            TypeError for malformed payload.
        """

        self.nodules = {nodule_id: dict(values) for nodule_id, values in payload.items()}
        # AUDIT: nodule memory restore.
        audit_log(
            component="memory.nodule_memory",
            event="restore_state",
            payload={"nodules": len(self.nodules)},
        )
