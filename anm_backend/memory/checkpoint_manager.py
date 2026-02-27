"""
FILE: memory/checkpoint_manager.py
RESPONSIBILITY: Local JSON checkpoint save/load for operational continuity.
FLOW ROLE: Support process restart without replacing RAM-first cognition.
READS: Serializable snapshot payloads.
RAM WRITES: None directly.
PERSISTS: JSON files under predictable local directory.
PRIMARY RISK: Corrupted file writes when process interruption occurs mid-save.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from anm_backend.audit import audit_log


@dataclass
class CheckpointManager:
    """
    Objective:
        Persist and retrieve snapshot payloads on local filesystem.
    Responsibilities:
        Write/read JSON checkpoints with deterministic naming.
    Limits:
        Does not mutate runtime memory directly.
    Mutates:
        Filesystem checkpoint artifacts.
    Must not:
        Be treated as cognition center.
    """

    base_dir: Path

    def __post_init__(self) -> None:
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def create(self, snapshot: Dict[str, Any], checkpoint_id: str) -> Path:
        path = self.base_dir / f"{checkpoint_id}.json"
        path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        audit_log(
            component="memory.checkpoint_manager",
            event="checkpoint_saved",
            payload={"checkpoint_id": checkpoint_id, "path": str(path)},
        )
        return path

    def load(self, checkpoint_id: str) -> Optional[Dict[str, Any]]:
        path = self.base_dir / f"{checkpoint_id}.json"
        if not path.exists():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
        audit_log(
            component="memory.checkpoint_manager",
            event="checkpoint_restored",
            payload={"checkpoint_id": checkpoint_id, "path": str(path)},
        )
        return payload
