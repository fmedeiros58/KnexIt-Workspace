"""
FILE: memory/global_social.py
RESPONSIBILITY: RAM partition for global_social memory signals.
FLOW ROLE: Specialized memory slice consumed by MemoryManager and orchestrator.
READS: Partition-specific updates from active cognition.
RAM WRITES: In-memory key-value map for this partition.
PERSISTS: Included in checkpoints as support state only.
PRIMARY RISK: Partition drift if writes bypass policy orchestration.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict

from anm_backend.audit import audit_log


@dataclass
class GlobalSocialStore:
    """
    Objective:
        Maintain partition-specific RAM state for global_social.
    Responsibilities:
        Expose read/write and snapshot/restore operations.
    Limits:
        No cross-partition routing or persistence control.
    Mutates:
        Local in-memory store.
    Must not:
        Replace RAM-first orchestration managed by MemoryManager.
    """

    data: Dict[str, Any] = field(default_factory=dict)

    def write(self, key: str, value: Any) -> None:
        """
        Purpose:
            Upsert partition value.
        Parameters:
            key: Entry key.
            value: Entry value.
        Returns:
            None.
        Side Effects:
            Emits AUDIT structured log.
        RAM Impact:
            Mutates local partition map.
        Persistence Impact:
            None directly.
        Expected Failures:
            None.
        """

        self.data[key] = value
        # AUDIT: partition RAM mutation.
        audit_log(component="memory.global_social", event="write", payload={"key": key})

    def read(self, key: str, default: Any = None) -> Any:
        """
        Purpose:
            Read partition value by key.
        Parameters:
            key: Entry key.
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

        return self.data.get(key, default)

    def export_state(self) -> Dict[str, Any]:
        """
        Purpose:
            Export serializable copy for checkpointing.
        Parameters:
            None.
        Returns:
            Dict[str, Any]: Snapshot payload.
        Side Effects:
            None.
        RAM Impact:
            Temporary copy allocation.
        Persistence Impact:
            Intended checkpoint payload.
        Expected Failures:
            None.
        """

        return dict(self.data)

    def restore_state(self, payload: Dict[str, Any]) -> None:
        """
        Purpose:
            Restore partition from snapshot payload.
        Parameters:
            payload: Serialized map.
        Returns:
            None.
        Side Effects:
            Replaces local partition data.
        RAM Impact:
            Overwrites local map in RAM.
        Persistence Impact:
            None directly.
        Expected Failures:
            TypeError for malformed payload.
        """

        self.data = dict(payload)
        # AUDIT: partition RAM restore.
        audit_log(component="memory.global_social", event="restore_state", payload={"size": len(self.data)})
