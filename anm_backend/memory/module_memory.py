"""
FILE: memory/module_memory.py
RESPONSIBILITY: Domain-specific RAM memory partitions.
FLOW ROLE: Supplies specialized context for targeted nodule execution.
READS: Domain updates from memory manager and parser feedback.
RAM WRITES: Per-module maps for semantic/procedural/perceptual context.
PERSISTS: Snapshot as operational support only.
PRIMARY RISK: Cross-domain leakage if module boundaries are ignored.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict

from anm_backend.audit import audit_log


@dataclass
class ModuleMemory:
    """
    Objective:
        Store specialized memory by functional domain.
    Responsibilities:
        Maintain per-module knowledge, procedures and local salience.
    Limits:
        Does not manage global identity coherence.
    Mutates:
        Internal module dictionary.
    Must not:
        Merge module scopes without explicit routing policy.
    """

    modules: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def write(self, module_id: str, key: str, value: Any) -> None:
        """
        Purpose:
            Upsert value in module-specific memory.
        Parameters:
            module_id: Module identifier.
            key: Entry key.
            value: Entry value.
        Returns:
            None.
        Side Effects:
            Emits AUDIT log.
        RAM Impact:
            Mutates module map.
        Persistence Impact:
            Included in checkpoint snapshots.
        Expected Failures:
            None.
        """

        bucket = self.modules.setdefault(module_id, {})
        bucket[key] = value
        # AUDIT: module-memory mutation in RAM.
        audit_log(
            component="memory.module_memory",
            event="write",
            payload={"module_id": module_id, "key": key},
        )

    def read(self, module_id: str, key: str, default: Any = None) -> Any:
        """
        Purpose:
            Read value from module-specific memory.
        Parameters:
            module_id: Module identifier.
            key: Entry key.
            default: Fallback value.
        Returns:
            Any: Stored value or default.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return self.modules.get(module_id, {}).get(key, default)

    def export_state(self) -> Dict[str, Dict[str, Any]]:
        """
        Purpose:
            Export serializable module-memory snapshot.
        Parameters:
            None.
        Returns:
            Dict[str, Dict[str, Any]]: Copy of module map.
        Side Effects:
            None.
        RAM Impact:
            Temporary copy allocation.
        Persistence Impact:
            Intended checkpoint payload.
        Expected Failures:
            None.
        """

        return {module_id: dict(values) for module_id, values in self.modules.items()}

    def restore_state(self, payload: Dict[str, Dict[str, Any]]) -> None:
        """
        Purpose:
            Restore module memory from serialized payload.
        Parameters:
            payload: Module state payload.
        Returns:
            None.
        Side Effects:
            Replaces module map in RAM.
        RAM Impact:
            Full replacement of module state.
        Persistence Impact:
            None directly.
        Expected Failures:
            TypeError for malformed payload.
        """

        self.modules = {module_id: dict(values) for module_id, values in payload.items()}
        # AUDIT: module-memory restore event.
        audit_log(
            component="memory.module_memory",
            event="restore_state",
            payload={"modules": len(self.modules)},
        )
