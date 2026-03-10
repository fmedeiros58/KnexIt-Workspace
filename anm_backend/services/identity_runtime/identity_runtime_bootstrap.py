"""
FILE: services/identity_runtime/identity_runtime_bootstrap.py
RESPONSIBILITY: Bootstrap controller for continuous identity runtime.
FLOW ROLE: Decides startup behavior independently of composer UI.
READS: Persistent runtime flags and environment defaults.
RAM WRITES: Runtime startup state.
PERSISTS: Delegated to runtime SQL service through runtime layer.
PRIMARY RISK: Incorrect startup policy can keep runtime unintentionally disabled.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from anm_backend.services.identity_runtime.continuous_identity_runtime import ContinuousIdentityRuntime


@dataclass
class IdentityRuntimeBootstrap:
    runtime: ContinuousIdentityRuntime

    def bootstrap(self, *, reason: str = "session_boot") -> Dict[str, object]:
        self.runtime.bootstrap(reason=reason)
        snapshot = self.runtime.snapshot()
        return {
            "ok": True,
            "reason": reason,
            "runtime_enabled": snapshot.runtime_enabled,
            "auto_start_enabled": snapshot.auto_start_enabled,
            "status": snapshot.status.value,
            "selected_source_id": snapshot.selected_source_id,
        }

