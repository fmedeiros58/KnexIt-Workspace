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
    created_at: str
    updated_at: str


class WriteProcessMemoryResponse(BaseModel):
    project_id: str
    process_memory: Dict[str, Any]


class WriteProcessMemoryCreateResponse(BaseModel):
    memory: WriteProcessMemoryItemView


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


class WriteProjectGlobalSummaryView(BaseModel):
    summary_id: str
    project_id: str
    summary: str
    summary_version: int
    source_chunk_count: int
    created_at: str
    updated_at: str


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
