"""
FILE: api/schemas.py
RESPONSIBILITY: HTTP request/response schemas for ANM API.
FLOW ROLE: Validate payloads and document explicit route contracts.
READS: Incoming HTTP JSON bodies.
RAM WRITES: Validated model instances only.
PERSISTS: None.
PRIMARY RISK: Schema drift with service payloads if not versioned.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class HypothesisSummary(BaseModel):
    id: str
    score: float
    origin_nodule: str
    stimulus_coherence: float


class ReadinessSummary(BaseModel):
    score: float
    state: str
    dominant_factors: List[str]


class RegulatorySummary(BaseModel):
    stress_load: float
    context_stability: float


class ChatResponse(BaseModel):
    trace_id: str
    answer: str
    collapsed_hypothesis: HypothesisSummary
    readiness: ReadinessSummary
    regulatory_state: RegulatorySummary
    engine: Dict[str, Any]


class IdentityRuntimeControlRequest(BaseModel):
    reason: str = Field(default="manual_control", max_length=240)


class IdentityRuntimeAutoStartRequest(BaseModel):
    enabled: bool = True


class IdentitySourceSelectRequest(BaseModel):
    source_id: str = Field(min_length=1, max_length=120)


class IdentitySourceActiveRequest(BaseModel):
    active: bool = True


class IdentitySourceUpsertRequest(BaseModel):
    source_id: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=220)
    source_type: str = Field(default="external", min_length=1, max_length=40)
    device_ref: str = Field(default="", max_length=500)
    resolution: str = Field(default="1280x720", max_length=80)
    fps: int = Field(default=30, ge=1, le=120)
    priority: int = Field(default=100, ge=1, le=1000)
    active: bool = True
    connected: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IdentityObservationRequest(BaseModel):
    source_id: str = Field(default="", max_length=120)
    face_detected: bool = True
    entity_id: str = Field(default="", max_length=120)
    label: str = Field(default="", max_length=220)
    confidence: float = Field(default=0.62, ge=0.0, le=1.0)
    mode: str = Field(default="tracking", max_length=64)
    validation_pending: bool = False
    conflict: bool = False
    nominal_name: str = Field(default="", max_length=220)
    speaker_id: str = Field(default="", max_length=120)
    self_user_present: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IdentitySourceView(BaseModel):
    source_id: str
    name: str
    source_type: str
    device_ref: str
    resolution: str
    fps: int
    priority: int
    active: bool
    connected: bool
    last_heartbeat_at: str
    metadata: Dict[str, Any]


class IdentityStreamView(BaseModel):
    stream_id: str
    source_id: str
    status: str
    started_at: str
    ended_at: Optional[str] = None
    fps_observed: float
    latency_ms: int
    dropped_frames: int
    metadata: Dict[str, Any]


class IdentityEntityView(BaseModel):
    entity_id: str
    label: str
    mode: str
    confidence: float
    source_id: Optional[str] = None
    voice_profile_id: Optional[str] = None
    nominal_name: Optional[str] = None
    first_seen_at: str
    last_seen_at: str
    metadata: Dict[str, Any]


class IdentityRuntimeStatusResponse(BaseModel):
    status: str
    runtime_enabled: bool
    runtime_paused: bool
    auto_start_enabled: bool
    selected_source_id: Optional[str] = None
    last_error: str = ""
    awareness_state: Dict[str, Any]
    camera_sources: List[IdentitySourceView]
    active_streams: List[IdentityStreamView]
    tracked_entities: List[IdentityEntityView]
    current_identity: Optional[IdentityEntityView] = None
    self_model_state: Dict[str, Any]
    user_pattern_state: Dict[str, Any]
    updated_at: str


class CheckpointRequest(BaseModel):
    checkpoint_id: str = Field(min_length=1, max_length=128)


class CheckpointResponse(BaseModel):
    ok: bool
    checkpoint_id: str
    path: Optional[str] = None


class RestoreResponse(BaseModel):
    ok: bool
    checkpoint_id: str


class WriteProjectCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    objective: str = Field(default="", max_length=4000)
    session_id: Optional[str] = Field(default=None, min_length=8, max_length=128)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WriteProjectPatchRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    objective: Optional[str] = Field(default=None, max_length=4000)
    status: Optional[str] = Field(default=None, min_length=1, max_length=32)
    metadata: Optional[Dict[str, Any]] = None
    metadata_replace: bool = Field(default=False)


class WriteSectionCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: str = Field(default="section", min_length=1, max_length=40)
    order: int = Field(default=0, ge=0, le=10_000)
    objective: str = Field(default="", max_length=4000)
    outline_notes: str = Field(default="", max_length=12_000)
    status: str = Field(default="planned", min_length=1, max_length=32)
    content: str = Field(default="", max_length=120_000)


class WriteReferenceAttachRequest(BaseModel):
    document_id: int = Field(gt=0)
    source_path: Optional[str] = Field(default=None, max_length=1024)
    note: Optional[str] = Field(default=None, max_length=500)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WriteAssistRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=12_000)
    section_id: Optional[str] = Field(default=None, max_length=128)
    max_tokens: int = Field(default=1536, ge=64, le=8192)
    include_followup_prompt: bool = Field(default=False)


class WriteProcessMemoryCreateRequest(BaseModel):
    section_id: Optional[str] = Field(default=None, max_length=128)
    memory_type: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=240)
    content: str = Field(min_length=1, max_length=20_000)
    priority: int = Field(default=100, ge=0, le=1000)
    is_active: bool = Field(default=True)


class WriteProcessMemoryPatchRequest(BaseModel):
    memory_type: Optional[str] = Field(default=None, min_length=1, max_length=40)
    title: Optional[str] = Field(default=None, min_length=1, max_length=240)
    content: Optional[str] = Field(default=None, min_length=1, max_length=20_000)
    priority: Optional[int] = Field(default=None, ge=0, le=1000)
    is_active: Optional[bool] = None
    section_id: Optional[str] = Field(default=None, max_length=128)
    deactivation_reason: Optional[str] = Field(default=None, max_length=240)
    consolidated_into_memory_id: Optional[str] = Field(default=None, max_length=128)


class WriteMemoryConsolidateRequest(BaseModel):
    similarity_threshold: float = Field(default=0.96, ge=0.6, le=1.0)
    ttl_days: int = Field(default=45, ge=0, le=3650)
    low_priority_max: int = Field(default=200, ge=0, le=1000)
    dry_run: bool = Field(default=False)


class WriteContinueRequest(BaseModel):
    project_id: str = Field(min_length=3, max_length=128)
    instruction: str = Field(min_length=1, max_length=16_000)
    section_id: Optional[str] = Field(default=None, max_length=128)
    top_k_chunks: int = Field(default=6, ge=1, le=20)
    top_k_memories: int = Field(default=6, ge=1, le=20)
    min_paragraphs: int = Field(default=2, ge=1, le=8)
    max_paragraphs: int = Field(default=4, ge=1, le=8)
    max_tokens: int = Field(default=1400, ge=128, le=8192)
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)


class WriteSectionPatchRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    objective: Optional[str] = Field(default=None, max_length=4000)
    outline_notes: Optional[str] = Field(default=None, max_length=12_000)
    status: Optional[str] = Field(default=None, min_length=1, max_length=32)
    order: Optional[int] = Field(default=None, ge=0, le=10_000)


class WriteInsertRequest(BaseModel):
    project_id: str = Field(min_length=3, max_length=128)
    section_id: str = Field(min_length=3, max_length=128)
    content: str = Field(min_length=1, max_length=120_000)
    source_type: str = Field(default="user_inserted", min_length=1, max_length=40)
    role: str = Field(default="user", min_length=1, max_length=40)
    chunk_order: Optional[int] = Field(default=None, ge=0, le=200_000)
    version: int = Field(default=1, ge=1, le=10_000)
    token_count: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    update_embedding: bool = Field(default=True)
    summarize_section: bool = Field(default=False)
    summarize_project: bool = Field(default=False)


class WriteChunkPatchRequest(BaseModel):
    content: str = Field(min_length=1, max_length=120_000)
    edit_source: str = Field(default="user_edit", min_length=1, max_length=40)
    token_count: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    update_embedding: bool = Field(default=True)
    summarize_section: bool = Field(default=False)
    summarize_project: bool = Field(default=False)


class WriteChunkAutosaveRequest(BaseModel):
    content: str = Field(min_length=1, max_length=120_000)
    client_version: int = Field(ge=1, le=1_000_000)
    autosave_reason: str = Field(default="interval_tick", min_length=1, max_length=64)
    editor_session_id: Optional[str] = Field(default=None, min_length=3, max_length=128)
    client_timestamp: Optional[str] = Field(default=None, max_length=64)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    reindex_embedding: bool = Field(default=True)


class WriteChunkView(BaseModel):
    chunk_id: str
    project_id: str
    section_id: str
    role: str
    text: str
    source_type: str
    chunk_order: int
    version: int
    char_count: int
    token_count: Optional[int]
    created_at: str
    updated_at: str
    metadata: Dict[str, Any]


class WriteChunkVersionView(BaseModel):
    version_id: str
    draft_chunk_id: str
    project_id: str
    section_id: str
    version_number: int
    previous_version_id: Optional[str]
    content_snapshot: str
    edit_source: str
    created_at: str
    metadata: Dict[str, Any]


class WriteSectionView(BaseModel):
    section_id: str
    project_id: str
    title: str
    kind: str
    order: int
    objective: str
    outline_notes: str
    status: str
    content: str
    summary: str
    summary_record: Optional[Dict[str, Any]] = None
    updated_at: str
    chunks: List[WriteChunkView]


class WriteReferenceView(BaseModel):
    reference_id: str
    document_id: int
    source_path: str
    note: str
    metadata: Dict[str, Any]
    created_at: str


class WriteProjectSummaryView(BaseModel):
    project_id: str
    title: str
    status: str
    updated_at: str
    sections_count: int
    references_count: int


class WriteProjectView(BaseModel):
    project_id: str
    title: str
    description: str
    objective: str
    owner_session_id: Optional[str]
    status: str
    process_summary: str
    metadata: Dict[str, Any]
    created_at: str
    updated_at: str
    sections: List[WriteSectionView]
    references: List[WriteReferenceView]


class WriteProjectListResponse(BaseModel):
    projects: List[WriteProjectSummaryView]


class WriteProjectResponse(BaseModel):
    project: WriteProjectView


class WriteSectionResponse(BaseModel):
    section: WriteSectionView


class WriteProjectSectionsResponse(BaseModel):
    project_id: str
    sections: List[WriteSectionView]


class WriteReferenceResponse(BaseModel):
    reference: WriteReferenceView


class WriteAssistResponse(BaseModel):
    trace_id: str
    project_id: str
    section_id: str
    answer: str
    engine: Dict[str, Any]


class WriteProcessMemoryItemView(BaseModel):
    memory_id: str
    project_id: str
    section_id: Optional[str]
    memory_type: str
    title: str
    content: str
    priority: int
    is_active: bool
    use_count: int
    last_used_at: Optional[str]
    deactivated_at: Optional[str]
    deactivation_reason: str
    consolidated_into_memory_id: Optional[str]
    created_at: str
    updated_at: str


class WriteProcessMemoryResponse(BaseModel):
    project_id: str
    process_memory: Dict[str, Any]


class WriteProcessMemoryInactiveResponse(BaseModel):
    project_id: str
    inactive_memory: List[WriteProcessMemoryItemView]


class WriteProcessMemoryCreateResponse(BaseModel):
    memory: WriteProcessMemoryItemView


class WriteProcessMemoryPatchResponse(BaseModel):
    memory: WriteProcessMemoryItemView


class WriteMemoryConsolidateResponse(BaseModel):
    trace_id: str
    project_id: str
    dry_run: bool
    similarity_threshold: float
    ttl_days: int
    low_priority_max: int
    duplicate_groups: List[Dict[str, Any]]
    deactivated_memory_ids: List[str]
    kept_memory_ids: List[str]
    deactivated_by_ttl_ids: List[str]
    active_count: int
    inactive_count: int


class WriteSectionStalenessResponse(BaseModel):
    section_id: str
    is_stale: bool
    stale_reasons: List[str]


class WriteProjectStalenessResponse(BaseModel):
    project_id: str
    is_stale: bool
    stale_reasons: List[str]


class WriteSectionSummaryView(BaseModel):
    summary_id: str
    project_id: str
    section_id: str
    summary: str
    summary_version: int
    source_chunk_count: int
    last_chunk_id_processed: Optional[str]
    created_at: str
    updated_at: str
    is_stale: bool = False
    stale_reasons: List[str] = Field(default_factory=list)


class WriteProjectGlobalSummaryView(BaseModel):
    summary_id: str
    project_id: str
    summary: str
    summary_version: int
    source_chunk_count: int
    created_at: str
    updated_at: str
    is_stale: bool = False
    stale_reasons: List[str] = Field(default_factory=list)


class WriteChunkResummarizeResponse(BaseModel):
    trace_id: str
    chunk_id: str
    project_id: str
    section_id: str
    section_summary: WriteSectionSummaryView
    project_summary: WriteProjectGlobalSummaryView


class WriteSectionSummaryResponse(BaseModel):
    summary: WriteSectionSummaryView


class WriteProjectGlobalSummaryResponse(BaseModel):
    summary: WriteProjectGlobalSummaryView


class WriteSectionSummarizeResponse(BaseModel):
    updated: bool
    trace_id: str
    summary: WriteSectionSummaryView


class WriteProjectSummarizeResponse(BaseModel):
    updated: bool
    trace_id: str
    summary: WriteProjectGlobalSummaryView


class WriteInsertResponse(BaseModel):
    trace_id: str
    project_id: str
    section_id: str
    chunk: WriteChunkView
    applied: Dict[str, bool]
    section_summary: Optional[WriteSectionSummaryView]
    project_summary: Optional[WriteProjectGlobalSummaryView]


class WriteChunkResponse(BaseModel):
    chunk: WriteChunkView


class WriteChunkVersionsResponse(BaseModel):
    chunk_id: str
    versions: List[WriteChunkVersionView]


class WriteChunkPatchResponse(BaseModel):
    trace_id: str
    project_id: str
    section_id: str
    chunk: WriteChunkView
    version_record: WriteChunkVersionView
    applied: Dict[str, bool]
    section_summary: Optional[WriteSectionSummaryView]
    project_summary: Optional[WriteProjectGlobalSummaryView]


class WriteChunkAutosaveResponse(BaseModel):
    trace_id: str
    chunk_id: str
    project_id: str
    section_id: str
    status: str
    conflict: bool
    client_version: int
    server_version: int
    server_updated_at: str
    autosave_reason: str
    editor_session_id: Optional[str]
    chunk: WriteChunkView
    version_record: Optional[WriteChunkVersionView]
    reindex_applied: bool


class WriteReindexResponse(BaseModel):
    trace_id: str
    scope: str
    project_id: str
    section_id: Optional[str]
    chunk_id: Optional[str]
    reindexed_chunk_ids: List[str]
    reindexed_count: int
    failed_chunk_ids: List[str]
    embedding_model: str
    reindexed_at: str


class WriteContinueResponse(BaseModel):
    trace_id: str
    project_id: str
    section_id: str
    chunk: WriteChunkView
    retrieved_chunk_ids: List[str]
    retrieved_memory_ids: List[str]
    section_summary_used: Optional[WriteSectionSummaryView]
    project_global_summary_used: Optional[WriteProjectGlobalSummaryView]
    top_k_applied: Dict[str, int]
    parameters: Dict[str, Any]
