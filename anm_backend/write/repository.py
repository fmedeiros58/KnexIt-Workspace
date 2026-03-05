"""
FILE: write/repository.py
RESPONSIBILITY: Persistence boundary for write workspace domain.
FLOW ROLE: Repository abstraction and in-memory bootstrap implementation.
READS: Write project records from internal storage backend.
RAM WRITES: In-memory store updates for projects, sections, chunks and embeddings.
PERSISTS: None in bootstrap implementation (future Postgres adapter point).
PRIMARY RISK: In-memory adapter is process-local and non-durable.
"""

from __future__ import annotations

from copy import deepcopy
from threading import RLock
from typing import Any, Dict, List, Optional, Protocol, Tuple
from uuid import uuid4

from anm_backend.contracts import utc_now_iso
from anm_backend.write.contracts import (
    WriteChunk,
    WriteChunkVersion,
    WriteDraftChunkEmbedding,
    WriteProcessMemoryEmbedding,
    WriteProcessMemoryItem,
    WriteProject,
    WriteProjectGlobalSummary,
    WriteReference,
    WriteSection,
    WriteSectionSummary,
)
from anm_backend.write.errors import WriteChunkVersionConflictError

_VALID_SOURCE_TYPES = {"generated", "user_inserted", "edited"}
_VALID_EDIT_SOURCES = {"generated", "user_inserted", "edited", "user_edit", "system_edit"}
_VALID_SECTION_STATUS = {"planned", "drafting", "review", "done", "archived"}
_VALID_MEMORY_TYPES = {"rule", "constraint", "decision", "definition", "terminology", "warning"}


class WriteWorkspaceRepository(Protocol):
    def list_projects(self, *, limit: int = 20) -> List[WriteProject]:
        ...

    def create_project(
        self,
        *,
        title: str,
        objective: str,
        owner_session_id: Optional[str],
        metadata: Dict[str, object],
    ) -> WriteProject:
        ...

    def get_project(self, project_id: str) -> Optional[WriteProject]:
        ...

    def update_project(
        self,
        *,
        project_id: str,
        title: Optional[str] = None,
        objective: Optional[str] = None,
        status: Optional[str] = None,
        metadata: Optional[Dict[str, object]] = None,
        metadata_replace: bool = False,
    ) -> WriteProject:
        ...

    def create_section(
        self,
        *,
        project_id: str,
        title: str,
        kind: str,
        order: int,
        content: str,
        objective: str = "",
        outline_notes: str = "",
        status: str = "planned",
    ) -> WriteSection:
        ...

    def get_section(self, *, project_id: str, section_id: str) -> Optional[WriteSection]:
        ...

    def list_project_sections(self, *, project_id: str) -> List[WriteSection]:
        ...

    def update_section(
        self,
        *,
        section_id: str,
        title: Optional[str] = None,
        objective: Optional[str] = None,
        outline_notes: Optional[str] = None,
        status: Optional[str] = None,
        order: Optional[int] = None,
        content: Optional[str] = None,
    ) -> Tuple[WriteProject, WriteSection]:
        ...

    def append_chunk(
        self,
        *,
        project_id: str,
        section_id: str,
        role: str,
        text: str,
        metadata: Dict[str, object],
        source_type: str = "generated",
        chunk_order: Optional[int] = None,
        version: int = 1,
        token_count: Optional[int] = None,
    ) -> WriteChunk:
        ...

    def get_chunk(self, *, chunk_id: str) -> Optional[WriteChunk]:
        ...

    def edit_chunk(
        self,
        *,
        chunk_id: str,
        content: str,
        edit_source: str,
        expected_version: Optional[int] = None,
        token_count: Optional[int] = None,
        metadata: Optional[Dict[str, object]] = None,
    ) -> Tuple[WriteProject, WriteSection, WriteChunk, WriteChunkVersion]:
        ...

    def list_chunk_versions(self, *, chunk_id: str) -> List[WriteChunkVersion]:
        ...

    def list_project_chunks(self, *, project_id: str) -> List[WriteChunk]:
        ...

    def attach_reference(
        self,
        *,
        project_id: str,
        document_id: int,
        source_path: str,
        note: str,
        metadata: Dict[str, object],
    ) -> WriteReference:
        ...

    def update_process_summary(self, *, project_id: str, summary: str) -> WriteProject:
        ...

    def create_process_memory_item(
        self,
        *,
        project_id: str,
        section_id: Optional[str],
        memory_type: str,
        title: str,
        content: str,
        priority: int = 100,
        is_active: bool = True,
    ) -> WriteProcessMemoryItem:
        ...

    def get_process_memory_item(self, *, memory_id: str) -> Optional[WriteProcessMemoryItem]:
        ...

    def list_process_memory_items(
        self,
        *,
        project_id: str,
        section_id: Optional[str] = None,
        active_only: bool = False,
    ) -> List[WriteProcessMemoryItem]:
        ...

    def update_process_memory_item(
        self,
        *,
        memory_id: str,
        memory_type: Optional[str] = None,
        title: Optional[str] = None,
        content: Optional[str] = None,
        priority: Optional[int] = None,
        is_active: Optional[bool] = None,
        section_id: Optional[str] = None,
        deactivation_reason: Optional[str] = None,
        consolidated_into_memory_id: Optional[str] = None,
    ) -> WriteProcessMemoryItem:
        ...

    def mark_process_memory_used(self, *, memory_id: str) -> WriteProcessMemoryItem:
        ...

    def upsert_draft_chunk_embedding(
        self,
        *,
        draft_chunk_id: str,
        embedding: List[float],
        embedding_model: str,
    ) -> WriteDraftChunkEmbedding:
        ...

    def get_draft_chunk_embedding(self, *, draft_chunk_id: str) -> Optional[WriteDraftChunkEmbedding]:
        ...

    def upsert_process_memory_embedding(
        self,
        *,
        process_memory_id: str,
        embedding: List[float],
        embedding_model: str,
    ) -> WriteProcessMemoryEmbedding:
        ...

    def get_process_memory_embedding(self, *, process_memory_id: str) -> Optional[WriteProcessMemoryEmbedding]:
        ...

    def get_section_context(self, *, section_id: str) -> Optional[Tuple[WriteProject, WriteSection]]:
        ...

    def upsert_section_summary(
        self,
        *,
        project_id: str,
        section_id: str,
        summary: str,
        source_chunk_count: int,
        last_chunk_id_processed: Optional[str],
    ) -> Tuple[WriteSectionSummary, bool]:
        ...

    def get_section_summary(self, *, section_id: str) -> Optional[WriteSectionSummary]:
        ...

    def list_section_summaries(self, *, project_id: str) -> List[WriteSectionSummary]:
        ...

    def upsert_project_global_summary(
        self,
        *,
        project_id: str,
        summary: str,
        source_chunk_count: int,
    ) -> Tuple[WriteProjectGlobalSummary, bool]:
        ...

    def get_project_global_summary(self, *, project_id: str) -> Optional[WriteProjectGlobalSummary]:
        ...


class InMemoryWriteWorkspaceRepository:
    def __init__(self) -> None:
        self._projects: Dict[str, WriteProject] = {}
        self._chunk_versions: Dict[str, List[WriteChunkVersion]] = {}
        self._section_summaries: Dict[str, WriteSectionSummary] = {}
        self._project_summaries: Dict[str, WriteProjectGlobalSummary] = {}
        self._draft_chunk_embeddings: Dict[str, WriteDraftChunkEmbedding] = {}
        self._process_memory_items: Dict[str, WriteProcessMemoryItem] = {}
        self._process_memory_embeddings: Dict[str, WriteProcessMemoryEmbedding] = {}
        self._lock = RLock()

    def list_projects(self, *, limit: int = 20) -> List[WriteProject]:
        with self._lock:
            ordered = sorted(self._projects.values(), key=lambda project: project.updated_at, reverse=True)
            return [deepcopy(project) for project in ordered[: max(1, limit)]]

    def create_project(
        self,
        *,
        title: str,
        objective: str,
        owner_session_id: Optional[str],
        metadata: Dict[str, object],
    ) -> WriteProject:
        with self._lock:
            project_id = f"wrp-{uuid4()}"
            project = WriteProject(
                project_id=project_id,
                title=title.strip(),
                objective=objective.strip(),
                owner_session_id=owner_session_id.strip() if owner_session_id else None,
                metadata=dict(metadata),
            )
            self._projects[project_id] = project
            return deepcopy(project)

    def get_project(self, project_id: str) -> Optional[WriteProject]:
        with self._lock:
            project = self._projects.get(project_id)
            return deepcopy(project) if project else None

    def update_project(
        self,
        *,
        project_id: str,
        title: Optional[str] = None,
        objective: Optional[str] = None,
        status: Optional[str] = None,
        metadata: Optional[Dict[str, object]] = None,
        metadata_replace: bool = False,
    ) -> WriteProject:
        with self._lock:
            project = self._require_project(project_id)
            now = utc_now_iso()
            if title is not None:
                project.title = title.strip() or project.title
            if objective is not None:
                project.objective = objective.strip()
            if status is not None:
                project.status = self._normalize_project_status(status)
            if metadata is not None:
                if metadata_replace:
                    project.metadata = dict(metadata)
                else:
                    merged = dict(project.metadata)
                    merged.update(dict(metadata))
                    project.metadata = merged
            project.updated_at = now
            return deepcopy(project)

    def create_section(
        self,
        *,
        project_id: str,
        title: str,
        kind: str,
        order: int,
        content: str,
        objective: str = "",
        outline_notes: str = "",
        status: str = "planned",
    ) -> WriteSection:
        with self._lock:
            project = self._require_project(project_id)
            now = utc_now_iso()
            section = WriteSection(
                section_id=f"wrs-{uuid4()}",
                project_id=project_id,
                title=title.strip(),
                kind=kind.strip(),
                order=max(0, int(order)),
                objective=objective.strip(),
                outline_notes=outline_notes.strip(),
                status=self._normalize_section_status(status),
                content=content.strip(),
                updated_at=now,
            )
            project.sections.append(section)
            project.sections.sort(key=lambda item: (item.order, item.updated_at))
            project.updated_at = now
            return deepcopy(section)

    def get_section(self, *, project_id: str, section_id: str) -> Optional[WriteSection]:
        with self._lock:
            project = self._projects.get(project_id)
            if not project:
                return None
            for section in project.sections:
                if section.section_id == section_id:
                    return deepcopy(section)
            return None

    def list_project_sections(self, *, project_id: str) -> List[WriteSection]:
        with self._lock:
            project = self._projects.get(project_id)
            if not project:
                return []
            ordered = sorted(project.sections, key=lambda section: (section.order, section.updated_at))
            return [deepcopy(item) for item in ordered]

    def update_section(
        self,
        *,
        section_id: str,
        title: Optional[str] = None,
        objective: Optional[str] = None,
        outline_notes: Optional[str] = None,
        status: Optional[str] = None,
        order: Optional[int] = None,
        content: Optional[str] = None,
    ) -> Tuple[WriteProject, WriteSection]:
        with self._lock:
            project, section = self._require_project_section_by_section_id(section_id=section_id)
            now = utc_now_iso()
            if title is not None:
                section.title = title.strip() or section.title
            if objective is not None:
                section.objective = objective.strip()
            if outline_notes is not None:
                section.outline_notes = outline_notes.strip()
            if status is not None:
                section.status = self._normalize_section_status(status)
            if order is not None:
                section.order = max(0, int(order))
            if content is not None:
                section.content = content.strip()
            section.updated_at = now
            project.sections.sort(key=lambda item: (item.order, item.updated_at))
            project.updated_at = now
            return deepcopy(project), deepcopy(section)

    def append_chunk(
        self,
        *,
        project_id: str,
        section_id: str,
        role: str,
        text: str,
        metadata: Dict[str, object],
        source_type: str = "generated",
        chunk_order: Optional[int] = None,
        version: int = 1,
        token_count: Optional[int] = None,
    ) -> WriteChunk:
        with self._lock:
            project = self._require_project(project_id)
            section = self._require_section(project, section_id)
            normalized_text = text.strip()
            now = utc_now_iso()
            next_chunk_order = self._resolve_next_chunk_order(section) if chunk_order is None else max(0, int(chunk_order))
            normalized_version = max(1, int(version))
            chunk = WriteChunk(
                chunk_id=f"wrc-{uuid4()}",
                project_id=project_id,
                section_id=section.section_id,
                role=role.strip() or "assistant",
                text=normalized_text,
                source_type=self._normalize_source_type(source_type),
                chunk_order=next_chunk_order,
                version=normalized_version,
                char_count=len(normalized_text),
                token_count=max(0, int(token_count)) if token_count is not None else None,
                created_at=now,
                updated_at=now,
                metadata=dict(metadata),
            )
            section.chunks.append(chunk)
            section.chunks.sort(key=lambda item: (item.chunk_order, item.version, item.created_at))
            section.content = self._build_section_content(section)
            section.updated_at = now
            project.updated_at = now
            self._append_chunk_version(
                chunk=chunk,
                version_number=normalized_version,
                edit_source=chunk.source_type,
                metadata={"origin": "append_chunk"},
            )
            return deepcopy(chunk)

    def get_chunk(self, *, chunk_id: str) -> Optional[WriteChunk]:
        with self._lock:
            try:
                _, _, chunk = self._find_chunk_context(chunk_id)
            except KeyError:
                return None
            return deepcopy(chunk)

    def edit_chunk(
        self,
        *,
        chunk_id: str,
        content: str,
        edit_source: str,
        expected_version: Optional[int] = None,
        token_count: Optional[int] = None,
        metadata: Optional[Dict[str, object]] = None,
    ) -> Tuple[WriteProject, WriteSection, WriteChunk, WriteChunkVersion]:
        with self._lock:
            project, section, chunk = self._find_chunk_context(chunk_id)
            normalized_content = content.strip()
            if not normalized_content:
                raise ValueError("chunk content must not be empty")
            if expected_version is not None and int(expected_version) != int(chunk.version):
                raise WriteChunkVersionConflictError(
                    chunk_id=chunk_id,
                    client_version=int(expected_version),
                    server_version=int(chunk.version),
                    server_updated_at=chunk.updated_at,
                )

            now = utc_now_iso()
            next_version = max(1, int(chunk.version) + 1)
            chunk.text = normalized_content
            chunk.version = next_version
            chunk.source_type = "edited"
            chunk.char_count = len(normalized_content)
            chunk.token_count = max(0, int(token_count)) if token_count is not None else chunk.token_count

            merged_metadata = dict(chunk.metadata)
            if metadata:
                merged_metadata.update(dict(metadata))
            merged_metadata["edit_source"] = self._normalize_edit_source(edit_source)
            chunk.metadata = merged_metadata
            chunk.updated_at = now

            section.chunks.sort(key=lambda item: (item.chunk_order, item.version, item.created_at))
            section.content = self._build_section_content(section)
            section.updated_at = now
            project.updated_at = now

            version_record = self._append_chunk_version(
                chunk=chunk,
                version_number=next_version,
                edit_source=self._normalize_edit_source(edit_source),
                metadata={"origin": "edit_chunk", **(metadata or {})},
            )
            return deepcopy(project), deepcopy(section), deepcopy(chunk), deepcopy(version_record)

    def list_chunk_versions(self, *, chunk_id: str) -> List[WriteChunkVersion]:
        with self._lock:
            versions = self._chunk_versions.get(chunk_id, [])
            ordered = sorted(versions, key=lambda item: item.version_number, reverse=True)
            return [deepcopy(item) for item in ordered]

    def list_project_chunks(self, *, project_id: str) -> List[WriteChunk]:
        with self._lock:
            project = self._projects.get(project_id)
            if not project:
                return []
            chunks: List[WriteChunk] = []
            for section in project.sections:
                chunks.extend(section.chunks)
            chunks.sort(key=lambda item: (item.chunk_order, item.version, item.created_at))
            return [deepcopy(item) for item in chunks]

    def attach_reference(
        self,
        *,
        project_id: str,
        document_id: int,
        source_path: str,
        note: str,
        metadata: Dict[str, object],
    ) -> WriteReference:
        with self._lock:
            project = self._require_project(project_id)
            reference = WriteReference(
                reference_id=f"wrr-{uuid4()}",
                document_id=int(document_id),
                source_path=source_path.strip() or f"document:{document_id}",
                note=note.strip(),
                metadata=dict(metadata),
            )
            project.references.append(reference)
            project.updated_at = utc_now_iso()
            return deepcopy(reference)

    def update_process_summary(self, *, project_id: str, summary: str) -> WriteProject:
        with self._lock:
            project = self._require_project(project_id)
            project.process_summary = summary.strip()
            project.updated_at = utc_now_iso()
            return deepcopy(project)

    def create_process_memory_item(
        self,
        *,
        project_id: str,
        section_id: Optional[str],
        memory_type: str,
        title: str,
        content: str,
        priority: int = 100,
        is_active: bool = True,
    ) -> WriteProcessMemoryItem:
        with self._lock:
            project = self._require_project(project_id)
            if section_id:
                _ = self._require_section(project, section_id)
            now = utc_now_iso()
            item = WriteProcessMemoryItem(
                memory_id=f"wpm-{uuid4()}",
                project_id=project_id,
                section_id=section_id,
                memory_type=self._normalize_memory_type(memory_type),
                title=title.strip(),
                content=content.strip(),
                priority=max(0, min(1000, int(priority))),
                is_active=bool(is_active),
                use_count=0,
                last_used_at=None,
                deactivated_at=None if is_active else now,
                deactivation_reason="" if is_active else "created_inactive",
                consolidated_into_memory_id=None,
                created_at=now,
                updated_at=now,
            )
            self._process_memory_items[item.memory_id] = item
            project.updated_at = now
            return deepcopy(item)

    def get_process_memory_item(self, *, memory_id: str) -> Optional[WriteProcessMemoryItem]:
        with self._lock:
            item = self._process_memory_items.get(memory_id)
            return deepcopy(item) if item else None

    def list_process_memory_items(
        self,
        *,
        project_id: str,
        section_id: Optional[str] = None,
        active_only: bool = False,
    ) -> List[WriteProcessMemoryItem]:
        with self._lock:
            entries = [item for item in self._process_memory_items.values() if item.project_id == project_id]
            if section_id is not None:
                entries = [item for item in entries if item.section_id == section_id or item.section_id is None]
            if active_only:
                entries = [item for item in entries if item.is_active]
            entries.sort(key=self._memory_sort_key, reverse=True)
            return [deepcopy(item) for item in entries]

    def update_process_memory_item(
        self,
        *,
        memory_id: str,
        memory_type: Optional[str] = None,
        title: Optional[str] = None,
        content: Optional[str] = None,
        priority: Optional[int] = None,
        is_active: Optional[bool] = None,
        section_id: Optional[str] = None,
        deactivation_reason: Optional[str] = None,
        consolidated_into_memory_id: Optional[str] = None,
    ) -> WriteProcessMemoryItem:
        with self._lock:
            item = self._require_process_memory(memory_id)
            project = self._require_project(item.project_id)
            now = utc_now_iso()

            if memory_type is not None:
                item.memory_type = self._normalize_memory_type(memory_type)
            if title is not None:
                item.title = title.strip() or item.title
            if content is not None:
                item.content = content.strip() or item.content
            if priority is not None:
                item.priority = max(0, min(1000, int(priority)))
            if section_id is not None:
                if section_id:
                    _ = self._require_section(project, section_id)
                    item.section_id = section_id
                else:
                    item.section_id = None
            if consolidated_into_memory_id is not None:
                if consolidated_into_memory_id:
                    _ = self._require_process_memory(consolidated_into_memory_id)
                    item.consolidated_into_memory_id = consolidated_into_memory_id
                else:
                    item.consolidated_into_memory_id = None
            if is_active is not None:
                item.is_active = bool(is_active)
                if item.is_active:
                    item.deactivated_at = None
                    if deactivation_reason is not None:
                        item.deactivation_reason = deactivation_reason.strip()
                    else:
                        item.deactivation_reason = ""
                    item.consolidated_into_memory_id = None
                else:
                    item.deactivated_at = now
                    item.deactivation_reason = (deactivation_reason or "manual_deactivation").strip()
            elif deactivation_reason is not None:
                item.deactivation_reason = deactivation_reason.strip()

            item.updated_at = now
            project.updated_at = now
            return deepcopy(item)

    def mark_process_memory_used(self, *, memory_id: str) -> WriteProcessMemoryItem:
        with self._lock:
            item = self._require_process_memory(memory_id)
            now = utc_now_iso()
            item.use_count = max(0, int(item.use_count)) + 1
            item.last_used_at = now
            item.updated_at = now
            project = self._require_project(item.project_id)
            project.updated_at = now
            return deepcopy(item)

    def upsert_draft_chunk_embedding(
        self,
        *,
        draft_chunk_id: str,
        embedding: List[float],
        embedding_model: str,
    ) -> WriteDraftChunkEmbedding:
        with self._lock:
            chunk = self._find_chunk(draft_chunk_id)
            now = utc_now_iso()
            existing = self._draft_chunk_embeddings.get(draft_chunk_id)
            if existing:
                existing.embedding = list(embedding)
                existing.embedding_model = embedding_model.strip() or "unspecified"
                existing.created_at = now
                return deepcopy(existing)
            created = WriteDraftChunkEmbedding(
                embedding_id=f"wce-{uuid4()}",
                draft_chunk_id=chunk.chunk_id,
                embedding=list(embedding),
                embedding_model=embedding_model.strip() or "unspecified",
                created_at=now,
            )
            self._draft_chunk_embeddings[draft_chunk_id] = created
            return deepcopy(created)

    def get_draft_chunk_embedding(self, *, draft_chunk_id: str) -> Optional[WriteDraftChunkEmbedding]:
        with self._lock:
            row = self._draft_chunk_embeddings.get(draft_chunk_id)
            return deepcopy(row) if row else None

    def upsert_process_memory_embedding(
        self,
        *,
        process_memory_id: str,
        embedding: List[float],
        embedding_model: str,
    ) -> WriteProcessMemoryEmbedding:
        with self._lock:
            _ = self._require_process_memory(process_memory_id)
            now = utc_now_iso()
            existing = self._process_memory_embeddings.get(process_memory_id)
            if existing:
                existing.embedding = list(embedding)
                existing.embedding_model = embedding_model.strip() or "unspecified"
                existing.created_at = now
                return deepcopy(existing)
            created = WriteProcessMemoryEmbedding(
                embedding_id=f"wme-{uuid4()}",
                process_memory_id=process_memory_id,
                embedding=list(embedding),
                embedding_model=embedding_model.strip() or "unspecified",
                created_at=now,
            )
            self._process_memory_embeddings[process_memory_id] = created
            return deepcopy(created)

    def get_process_memory_embedding(self, *, process_memory_id: str) -> Optional[WriteProcessMemoryEmbedding]:
        with self._lock:
            row = self._process_memory_embeddings.get(process_memory_id)
            return deepcopy(row) if row else None

    def get_section_context(self, *, section_id: str) -> Optional[Tuple[WriteProject, WriteSection]]:
        with self._lock:
            for project in self._projects.values():
                for section in project.sections:
                    if section.section_id == section_id:
                        return deepcopy(project), deepcopy(section)
        return None

    def upsert_section_summary(
        self,
        *,
        project_id: str,
        section_id: str,
        summary: str,
        source_chunk_count: int,
        last_chunk_id_processed: Optional[str],
    ) -> Tuple[WriteSectionSummary, bool]:
        with self._lock:
            project = self._require_project(project_id)
            _ = self._require_section(project, section_id)
            existing = self._section_summaries.get(section_id)
            now = utc_now_iso()
            normalized_summary = summary.strip()
            normalized_source_count = max(0, int(source_chunk_count))
            normalized_last_chunk_id = last_chunk_id_processed.strip() if last_chunk_id_processed else None

            if existing:
                changed = (
                    existing.summary != normalized_summary
                    or existing.source_chunk_count != normalized_source_count
                    or existing.last_chunk_id_processed != normalized_last_chunk_id
                )
                if changed:
                    existing.summary = normalized_summary
                    existing.source_chunk_count = normalized_source_count
                    existing.last_chunk_id_processed = normalized_last_chunk_id
                    existing.summary_version += 1
                    existing.updated_at = now
                return deepcopy(existing), changed

            created = WriteSectionSummary(
                summary_id=f"wss-{uuid4()}",
                project_id=project_id,
                section_id=section_id,
                summary=normalized_summary,
                summary_version=1,
                source_chunk_count=normalized_source_count,
                last_chunk_id_processed=normalized_last_chunk_id,
                created_at=now,
                updated_at=now,
            )
            self._section_summaries[section_id] = created
            return deepcopy(created), True

    def get_section_summary(self, *, section_id: str) -> Optional[WriteSectionSummary]:
        with self._lock:
            summary = self._section_summaries.get(section_id)
            return deepcopy(summary) if summary else None

    def list_section_summaries(self, *, project_id: str) -> List[WriteSectionSummary]:
        with self._lock:
            summaries = [item for item in self._section_summaries.values() if item.project_id == project_id]
            summaries.sort(key=lambda item: item.updated_at, reverse=True)
            return [deepcopy(item) for item in summaries]

    def upsert_project_global_summary(
        self,
        *,
        project_id: str,
        summary: str,
        source_chunk_count: int,
    ) -> Tuple[WriteProjectGlobalSummary, bool]:
        with self._lock:
            _ = self._require_project(project_id)
            existing = self._project_summaries.get(project_id)
            now = utc_now_iso()
            normalized_summary = summary.strip()
            normalized_source_count = max(0, int(source_chunk_count))

            if existing:
                changed = (
                    existing.summary != normalized_summary
                    or existing.source_chunk_count != normalized_source_count
                )
                if changed:
                    existing.summary = normalized_summary
                    existing.source_chunk_count = normalized_source_count
                    existing.summary_version += 1
                    existing.updated_at = now
                return deepcopy(existing), changed

            created = WriteProjectGlobalSummary(
                summary_id=f"wpg-{uuid4()}",
                project_id=project_id,
                summary=normalized_summary,
                summary_version=1,
                source_chunk_count=normalized_source_count,
                created_at=now,
                updated_at=now,
            )
            self._project_summaries[project_id] = created
            return deepcopy(created), True

    def get_project_global_summary(self, *, project_id: str) -> Optional[WriteProjectGlobalSummary]:
        with self._lock:
            summary = self._project_summaries.get(project_id)
            return deepcopy(summary) if summary else None

    def _require_project(self, project_id: str) -> WriteProject:
        project = self._projects.get(project_id)
        if not project:
            raise KeyError(f"write project not found: {project_id}")
        return project

    def _require_project_section_by_section_id(self, *, section_id: str) -> Tuple[WriteProject, WriteSection]:
        for project in self._projects.values():
            for section in project.sections:
                if section.section_id == section_id:
                    return project, section
        raise KeyError(f"write section not found: {section_id}")

    @staticmethod
    def _require_section(project: WriteProject, section_id: str) -> WriteSection:
        for section in project.sections:
            if section.section_id == section_id:
                return section
        raise KeyError(f"write section not found: {section_id}")

    def _find_chunk(self, chunk_id: str) -> WriteChunk:
        _, _, chunk = self._find_chunk_context(chunk_id)
        return chunk

    def _find_chunk_context(self, chunk_id: str) -> Tuple[WriteProject, WriteSection, WriteChunk]:
        for project in self._projects.values():
            for section in project.sections:
                for chunk in section.chunks:
                    if chunk.chunk_id == chunk_id:
                        return project, section, chunk
        raise KeyError(f"write chunk not found: {chunk_id}")

    def _append_chunk_version(
        self,
        *,
        chunk: WriteChunk,
        version_number: int,
        edit_source: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> WriteChunkVersion:
        versions = self._chunk_versions.setdefault(chunk.chunk_id, [])
        previous_version_id = versions[-1].version_id if versions else None
        record = WriteChunkVersion(
            version_id=f"wcv-{uuid4()}",
            draft_chunk_id=chunk.chunk_id,
            project_id=chunk.project_id,
            section_id=chunk.section_id,
            version_number=max(1, int(version_number)),
            previous_version_id=previous_version_id,
            content_snapshot=chunk.text,
            edit_source=self._normalize_edit_source(edit_source),
            metadata=dict(metadata or {}),
        )
        versions.append(record)
        versions.sort(key=lambda item: item.version_number)
        return record

    def _require_process_memory(self, process_memory_id: str) -> WriteProcessMemoryItem:
        item = self._process_memory_items.get(process_memory_id)
        if not item:
            raise KeyError(f"write process memory not found: {process_memory_id}")
        return item

    @staticmethod
    def _resolve_next_chunk_order(section: WriteSection) -> int:
        if not section.chunks:
            return 0
        return max(item.chunk_order for item in section.chunks) + 1

    @staticmethod
    def _build_section_content(section: WriteSection) -> str:
        ordered_chunks = sorted(section.chunks, key=lambda item: (item.chunk_order, item.created_at))
        return "\n".join(chunk.text for chunk in ordered_chunks if chunk.text.strip()).strip()

    @staticmethod
    def _normalize_source_type(source_type: str) -> str:
        normalized = (source_type or "").strip().lower()
        if normalized in _VALID_SOURCE_TYPES:
            return normalized
        return "generated"

    @staticmethod
    def _normalize_section_status(status: str) -> str:
        normalized = (status or "").strip().lower()
        if normalized in _VALID_SECTION_STATUS:
            return normalized
        return "planned"

    @staticmethod
    def _normalize_project_status(status: str) -> str:
        normalized = (status or "").strip().lower()
        if normalized in {"draft", "in_progress", "paused", "completed", "archived"}:
            return normalized
        return "draft"

    @staticmethod
    def _normalize_memory_type(memory_type: str) -> str:
        normalized = (memory_type or "").strip().lower()
        if normalized in _VALID_MEMORY_TYPES:
            return normalized
        return "rule"

    @staticmethod
    def _normalize_edit_source(edit_source: str) -> str:
        normalized = (edit_source or "").strip().lower()
        if normalized in _VALID_EDIT_SOURCES:
            return normalized
        return "user_edit"

    @staticmethod
    def _memory_sort_key(item: WriteProcessMemoryItem) -> Tuple[int, int, int, str]:
        usage_recency = item.last_used_at or item.updated_at
        return (
            int(bool(item.is_active)),
            int(item.priority),
            int(item.use_count),
            str(usage_recency),
        )
