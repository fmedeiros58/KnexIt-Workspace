"""
FILE: contracts.py
RESPONSIBILITY: Shared typed contracts for ANM MVP V2 runtime.
FLOW ROLE: Common data surface across memory, ANM, orchestrator, adapters and API.
READS: Runtime producers that construct typed records.
RAM WRITES: Type instances allocated in process memory only.
PERSISTS: Serialized through checkpoint and debug payloads.
PRIMARY RISK: Contract drift between modules if types are bypassed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, NewType, Optional

NoduleId = NewType("NoduleId", str)
PathwayId = NewType("PathwayId", str)
HypothesisId = NewType("HypothesisId", str)


def utc_now_iso() -> str:
    """
    Purpose:
        Return normalized UTC timestamp string.
    Parameters:
        None.
    Returns:
        str: ISO-8601 UTC timestamp.
    Side Effects:
        None.
    RAM Impact:
        Temporary string allocation.
    Persistence Impact:
        Used in persisted snapshots and logs.
    Expected Failures:
        None.
    """

    return datetime.now(tz=timezone.utc).isoformat()


class ReadinessState(str, Enum):
    """
    Objective:
        Represent computational plastic responsiveness classes.
    Responsibilities:
        Normalize gate states used across ANM components.
    Limits:
        State labels only, no behavior.
    Mutates:
        None.
    Must not:
        Encode domain logic directly.
    """

    BLOCKED = "BLOCKED"
    FRAGILE = "FRAGILE"
    OPEN = "OPEN"
    STABLE = "STABLE"
    AMPLIFIED = "AMPLIFIED"


@dataclass
class Signal:
    """
    Objective:
        Carry one resonance signal between nodules.
    Responsibilities:
        Preserve minimal traceable propagation metadata.
    Limits:
        Transport record only.
    Mutates:
        Metadata may be enriched by orchestrator.
    Must not:
        Own scheduling policy.
    """

    trace_id: str
    source_id: str
    target_id: str
    strength: float
    depth: int
    cycle_id: int
    timestamp: str = field(default_factory=utc_now_iso)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ActivationRecord:
    """
    Objective:
        Record nodule activation transitions.
    Responsibilities:
        Support debugging and checkpoint auditing.
    Limits:
        No routing semantics.
    Mutates:
        Immutable by convention after creation.
    Must not:
        Replace real-time activation maps.
    """

    nodule_id: str
    level: float
    cycle_id: int
    reason: str
    timestamp: str = field(default_factory=utc_now_iso)


@dataclass
class HypothesisState:
    """
    Objective:
        Hold one hypothesis state in RAM.
    Responsibilities:
        Track score/probability/cost and coherence.
    Limits:
        No collapse policy.
    Mutates:
        score, probability and metadata can evolve.
    Must not:
        Bypass hypothesis pool policies.
    """

    hypothesis_id: str
    summary: str
    score: float
    probability: float
    cost: float
    objective_fit: float
    stimulus_coherence: float = 0.5
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReadinessSnapshot:
    """
    Objective:
        Represent one readiness evaluation sample.
    Responsibilities:
        Expose score, state and dominant factors in a serializable format.
    Limits:
        Snapshot only.
    Mutates:
        Immutable by convention after append.
    Must not:
        Persist non-serializable objects.
    """

    readiness_score: float
    readiness_state: ReadinessState
    dominant_factors: List[str]
    metrics: Dict[str, float]
    timestamp: str = field(default_factory=utc_now_iso)


@dataclass
class RegulatoryStateSnapshot:
    """
    Objective:
        Serialize short-horizon regulatory variables.
    Responsibilities:
        Carry state needed to restore readiness behavior.
    Limits:
        Operational support only.
    Mutates:
        Immutable by convention after creation.
    Must not:
        Carry heavyweight runtime objects.
    """

    stress_load: float
    context_stability: float
    support_density: float
    recovery_margin: float
    affective_safety: float
    stimulus_consistency: float
    stimulus_coherence: float
    readiness_history: List[Dict[str, Any]]
    timestamp: str = field(default_factory=utc_now_iso)


@dataclass
class RouteDecision:
    """
    Objective:
        Describe one routing decision from orchestrator.
    Responsibilities:
        Bind destination with score and audit context.
    Limits:
        Output contract only.
    Mutates:
        None after creation by convention.
    Must not:
        Execute routing side effects.
    """

    target_id: str
    score: float
    pathway_id: str
    reason: str
    salience: float
    priority: float


@dataclass
class EngineRequest:
    """
    Objective:
        Wrap outgoing request to existing engine.
    Responsibilities:
        Keep adapter contract explicit and testable.
    Limits:
        No transport logic.
    Mutates:
        None after creation.
    Must not:
        Encode provider-specific side effects.
    """

    trace_id: str
    messages: List[Dict[str, str]]
    model: str
    max_tokens: int
    temperature: float
    top_p: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EngineResponse:
    """
    Objective:
        Normalize response coming from engine adapter.
    Responsibilities:
        Surface text and metadata for ANM flow.
    Limits:
        No memory mutation.
    Mutates:
        None after parse.
    Must not:
        Hide upstream errors.
    """

    trace_id: str
    model: str
    text: str
    usage: Dict[str, Any]
    raw: Dict[str, Any]
    command_signals: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class MemorySnapshot:
    """
    Objective:
        Composite serializable snapshot of memory layer.
    Responsibilities:
        Bundle RAM cortex, memory tiers and regulatory state.
    Limits:
        Operational checkpoint payload only.
    Mutates:
        Produced from live state on demand.
    Must not:
        Include non-serializable runtime handles.
    """

    cortex: Dict[str, Any]
    working_memory: List[Dict[str, Any]]
    global_memory: Dict[str, Dict[str, Any]]
    module_memory: Dict[str, Dict[str, Any]]
    nodule_memory: Dict[str, Dict[str, Any]]
    regulatory_state: Optional[Dict[str, Any]] = None
