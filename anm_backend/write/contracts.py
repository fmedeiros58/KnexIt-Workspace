"""
FILE: write/contracts.py
RESPONSIBILITY: Typed contracts for write workspace domain.
FLOW ROLE: Shared write models across repository, service and API.
READS: In-memory and persisted write workspace records.
RAM WRITES: Dataclass allocations for write project state.
PERSISTS: Serialized by repository adapters.
PRIMARY RISK: Contract drift between write service and API schemas.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from anm_backend.contracts import utc_now_iso


@dataclass
class WriteChunk:
    chunk_id: str
    project_id: str
    section_id: str
    role: str
    text: str
    source_type: str = "generated"
    chunk_order: int = 0
    version: int = 1
    char_count: int = 0
    token_count: Optional[int] = None
    created_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WriteChunkVersion:
    version_id: str
    draft_chunk_id: str
    project_id: str
    section_id: str
    version_number: int
    previous_version_id: Optional[str]
    content_snapshot: str
    edit_source: str
    created_at: str = field(default_factory=utc_now_iso)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WriteSection:
    section_id: str
    project_id: str
    title: str
    kind: str
    order: int
    objective: str = ""
    outline_notes: str = ""
    status: str = "planned"
    content: str = ""
    summary: str = ""
    chunks: List[WriteChunk] = field(default_factory=list)
    updated_at: str = field(default_factory=utc_now_iso)


@dataclass
class WriteReference:
    reference_id: str
    document_id: int
    source_path: str
    note: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=utc_now_iso)


@dataclass
class WriteProject:
    project_id: str
    title: str
    objective: str
    owner_session_id: Optional[str]
    status: str = "draft"
    process_summary: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    sections: List[WriteSection] = field(default_factory=list)
    references: List[WriteReference] = field(default_factory=list)
    created_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)


@dataclass
class WriteSectionSummary:
    summary_id: str
    project_id: str
    section_id: str
    summary: str
    summary_version: int = 1
    source_chunk_count: int = 0
    last_chunk_id_processed: Optional[str] = None
    created_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)


@dataclass
class WriteProjectGlobalSummary:
    summary_id: str
    project_id: str
    summary: str
    summary_version: int = 1
    source_chunk_count: int = 0
    created_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)


@dataclass
class WriteDraftChunkEmbedding:
    embedding_id: str
    draft_chunk_id: str
    embedding: List[float]
    embedding_model: str
    created_at: str = field(default_factory=utc_now_iso)


@dataclass
class WriteProcessMemoryItem:
    memory_id: str
    project_id: str
    section_id: Optional[str]
    memory_type: str
    title: str
    content: str
    priority: int = 100
    is_active: bool = True
    use_count: int = 0
    last_used_at: Optional[str] = None
    deactivated_at: Optional[str] = None
    deactivation_reason: str = ""
    consolidated_into_memory_id: Optional[str] = None
    created_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)


@dataclass
class WriteProcessMemoryEmbedding:
    embedding_id: str
    process_memory_id: str
    embedding: List[float]
    embedding_model: str
    created_at: str = field(default_factory=utc_now_iso)
