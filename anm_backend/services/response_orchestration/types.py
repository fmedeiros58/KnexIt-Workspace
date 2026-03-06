"""
FILE: services/response_orchestration/types.py
RESPONSIBILITY: Typed contracts for multi-step response orchestration.
FLOW ROLE: Shared request/state/result models across chat and write orchestration.
READS: Runtime prompt/context payloads.
RAM WRITES: Dataclass allocations in process memory.
PERSISTS: Secondary process memory state snapshots.
PRIMARY RISK: Contract drift with service integration points.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Callable, Dict, List, Literal, Optional

from anm_backend.contracts import EngineResponse, utc_now_iso

EmissionMode = Literal["chat", "write"]
EmissionResponseMode = Literal["single_pass", "multi_pass"]


@dataclass
class GenerationRequest:
    prompt: str
    mode: EmissionMode
    response_mode: EmissionResponseMode
    trace_id: str
    max_tokens: int
    temperature: float
    top_p: float
    cycle_index: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


GenerationCallable = Callable[[GenerationRequest], EngineResponse]


@dataclass
class EmissionPlan:
    response_mode: EmissionResponseMode
    should_use_multi_pass: bool
    complexity_score: float
    planned_sections: List[str]
    max_cycles: int
    target_chunk_tokens: int
    max_total_response_tokens: int
    min_cycles_required: int = 1
    rationale: List[str] = field(default_factory=list)
    phase0_enabled: bool = False
    phase0_call_count: int = 1
    phase0_segment_goal: str = ""
    phase0_target_style: str = ""
    phase0_join_rule: str = ""
    phase0_open_connector: str = ""
    phase0_first_chunk_min_tokens: int = 0
    phase0_first_chunk_max_tokens: int = 0
    phase0_per_call_max_tokens: int = 0


@dataclass
class GuardOutcome:
    passed: bool
    should_stop: bool
    reason: str
    score: float = 0.0
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SecondaryProcessMemoryState:
    session_id: str
    request_id: str
    user_id: str
    mode: EmissionMode
    project_id: Optional[str]
    thread_id: Optional[str]
    prompt_original: str
    objective_current: str
    response_mode: EmissionResponseMode
    planned_sections: List[str]
    current_step_index: int
    completed_steps: List[str]
    pending_steps: List[str]
    key_claims_established: List[str]
    constraints_active: List[str]
    forbidden_repetitions: List[str]
    terminology_locked: List[str]
    tone_locked: str
    partial_chunks: List[str]
    chunk_summaries: List[str]
    continuity_bridge: str
    local_decisions: List[str]
    open_loops: List[str]
    depth_frontier: str
    estimated_coverage: float
    redundancy_map: Dict[str, float]
    contradiction_flags: List[str]
    token_budget_consumed: int
    cycle_count: int
    max_cycles: int
    stop_reason: str
    continued_from_session_id: Optional[str] = None
    segment_goal: str = ""
    first_chunk: str = ""
    continuation_anchor: str = ""
    join_rule: str = ""
    target_style: str = ""
    phase0_call_count: int = 1
    phase0_open_connector: str = ""
    rolling_summary: str = ""
    compressed_state: Dict[str, Any] = field(default_factory=dict)
    semantic_state: Dict[str, Any] = field(default_factory=dict)
    next_intent: str = ""
    semantic_direction: str = ""
    continuity_rule: str = ""
    reflective_report: Dict[str, Any] = field(default_factory=dict)
    inference_map: Dict[str, Any] = field(default_factory=dict)
    redundancy_flags: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)
    expires_at: str = field(default_factory=utc_now_iso)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class OrchestrationRequest:
    request_id: str
    mode: EmissionMode
    user_id: str
    prompt_original: str
    objective_current: str
    context_payload: Dict[str, Any]
    max_tokens: int
    temperature: float
    top_p: float
    project_id: Optional[str] = None
    thread_id: Optional[str] = None
    tone_hint: str = ""
    planner_hints: List[str] = field(default_factory=list)
    locked_terminology: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)
    prefer_multi_pass: bool = False
    max_cycles_override: Optional[int] = None
    min_cycles_override: Optional[int] = None
    target_chunk_tokens_override: Optional[int] = None
    max_total_response_tokens_override: Optional[int] = None
    allow_single_pass_fallback: bool = True
    single_pass_generator: Optional[GenerationCallable] = None
    cycle_generator: Optional[GenerationCallable] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OrchestrationResult:
    request_id: str
    session_id: str
    mode: EmissionMode
    response_mode: str
    response_text: str
    cycle_count: int
    stop_reason: str
    token_budget_consumed: int
    fallback_used: bool
    partial_chunks: List[str]
    chunk_summaries: List[str]
    redundancy_events: int
    contradiction_events: int
    total_duration_ms: int
    models_used: List[str] = field(default_factory=list)
    usage: Dict[str, Any] = field(default_factory=dict)
    telemetry: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
