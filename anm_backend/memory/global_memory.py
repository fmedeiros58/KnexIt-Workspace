"""
FILE: memory/global_memory.py
RESPONSIBILITY: Global self-level memory state across cognitive sessions.
FLOW ROLE: Supplies macro identity, rules and broad context to active reasoning.
READS: Consolidated outputs from memory manager and parser feedback.
RAM WRITES: Global memory namespaces in RAM.
PERSISTS: Serializable snapshots through checkpoint/persistence bridge.
PRIMARY RISK: Drift in identity/rules if conflicting updates are ungoverned.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict

from anm_backend.audit import audit_log


@dataclass
class GlobalMemory:
    """
    Objective:
        Keep coherent global cognitive context in RAM.
    Responsibilities:
        Store high-level identity, semantic anchors, value signals and metacognitive flags.
    Limits:
        Not intended for low-latency short-term buffering.
    Mutates:
        Global namespace dictionaries.
    Must not:
        Bypass memory policies during consolidation.
    """

    namespaces: Dict[str, Dict[str, Any]] = field(
        default_factory=lambda: {
            "identity": {},
            "semantic": {},
            "procedural": {},
            "social": {},
            "value": {},
            "attention": {},
            "metacognitive": {},
            "prospective": {},
            "perceptual": {},
        }
    )

    def write(self, namespace: str, key: str, value: Any) -> None:
        """
        Purpose:
            Upsert value in a global-memory namespace.
        Parameters:
            namespace: Global namespace.
            key: Entry key.
            value: Entry value.
        Returns:
            None.
        Side Effects:
            Emits AUDIT log.
        RAM Impact:
            Mutates global namespace map.
        Persistence Impact:
            Included in checkpoints.
        Expected Failures:
            ValueError when namespace is unknown.
        """

        if namespace not in self.namespaces:
            raise ValueError(f"unknown global namespace: {namespace}")
        self.namespaces[namespace][key] = value
        # AUDIT: critical mutation in global memory.
        audit_log(
            component="memory.global_memory",
            event="write",
            payload={"namespace": namespace, "key": key},
        )

    def read(self, namespace: str, key: str, default: Any = None) -> Any:
        """
        Purpose:
            Read value from global-memory namespace.
        Parameters:
            namespace: Global namespace.
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

        return self.namespaces.get(namespace, {}).get(key, default)

    def export_state(self) -> Dict[str, Dict[str, Any]]:
        """
        Purpose:
            Export serializable snapshot for checkpoint.
        Parameters:
            None.
        Returns:
            Dict[str, Dict[str, Any]]: Copy of global memory.
        Side Effects:
            None.
        RAM Impact:
            Creates temporary dict copy.
        Persistence Impact:
            Intended checkpoint payload.
        Expected Failures:
            None.
        """

        return {namespace: dict(values) for namespace, values in self.namespaces.items()}

    def restore_state(self, payload: Dict[str, Dict[str, Any]]) -> None:
        """
        Purpose:
            Restore global memory from checkpoint payload.
        Parameters:
            payload: Serialized state.
        Returns:
            None.
        Side Effects:
            Replaces namespace contents.
        RAM Impact:
            Overwrites global namespace map.
        Persistence Impact:
            None directly.
        Expected Failures:
            TypeError for malformed payload.
        """

        for namespace in self.namespaces.keys():
            self.namespaces[namespace] = dict(payload.get(namespace, {}))
        # AUDIT: global memory restore event.
        audit_log(
            component="memory.global_memory",
            event="restore_state",
            payload={"namespaces": len(self.namespaces)},
        )
