"""
FILE: memory/persistence_bridge.py
RESPONSIBILITY: Bridge RAM cognition with local checkpoint persistence.
FLOW ROLE: Flush and restore snapshots while preserving RAM-first runtime.
READS: Memory manager snapshots and checkpoint payloads.
RAM WRITES: Delegated restore through memory manager.
PERSISTS: Local JSON checkpoint files.
PRIMARY RISK: Loading stale checkpoint can regress cognitive state.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from anm_backend.audit import audit_log
from anm_backend.memory.checkpoint_manager import CheckpointManager
from anm_backend.memory.memory_manager import MemoryManager


@dataclass
class PersistenceBridge:
    """
    Objective:
        Keep persistence as operational support only.
    Responsibilities:
        Flush checkpoints and restore memory manager state.
    Limits:
        No cognitive reasoning logic.
    Mutates:
        Delegates RAM mutation through restore.
    Must not:
        Drive cognition from disk.
    """

    memory_manager: MemoryManager
    checkpoint_manager: CheckpointManager

    def flush_checkpoint(self, checkpoint_id: str) -> str:
        snapshot = self.memory_manager.snapshot()
        path = self.checkpoint_manager.create(snapshot, checkpoint_id=checkpoint_id)
        audit_log(
            component="memory.persistence_bridge",
            event="checkpoint_saved",
            payload={"checkpoint_id": checkpoint_id, "path": str(path)},
        )
        return str(path)

    def bootstrap_from_checkpoint(self, checkpoint_id: str) -> bool:
        payload = self.checkpoint_manager.load(checkpoint_id=checkpoint_id)
        if payload is None:
            return False
        self.memory_manager.restore(payload)
        audit_log(
            component="memory.persistence_bridge",
            event="checkpoint_restored",
            payload={"checkpoint_id": checkpoint_id},
        )
        return True

    def replay(self, checkpoint_id: str) -> Optional[dict]:
        return self.checkpoint_manager.load(checkpoint_id=checkpoint_id)
