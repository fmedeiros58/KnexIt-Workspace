"""
FILE: services/response_orchestration/__init__.py
RESPONSIBILITY: Public exports for multi-step response orchestration layer.
FLOW ROLE: Shared orchestration surface consumed by chat and write services.
READS: Configuration and request payloads from service layer.
RAM WRITES: Delegated to orchestration services.
PERSISTS: Delegated to secondary process memory service (short TTL).
PRIMARY RISK: Import drift if service composition changes without updating exports.
"""

from anm_backend.services.response_orchestration.config import is_secondary_process_memory_enabled
from anm_backend.services.response_orchestration.response_orchestrator import ResponseOrchestrator
from anm_backend.services.response_orchestration.types import (
    EmissionPlan,
    GenerationRequest,
    GuardOutcome,
    OrchestrationRequest,
    OrchestrationResult,
    SecondaryProcessMemoryState,
)

__all__ = [
    "EmissionPlan",
    "GenerationRequest",
    "GuardOutcome",
    "OrchestrationRequest",
    "OrchestrationResult",
    "ResponseOrchestrator",
    "SecondaryProcessMemoryState",
    "is_secondary_process_memory_enabled",
]

