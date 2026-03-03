"""
FILE: services/write_service.py
RESPONSIBILITY: Orchestrate write workspace domain operations.
FLOW ROLE: Dedicated service layer for /write endpoints, separate from chat flow.
READS: Write repository state plus shared memory/LLM adapters.
RAM WRITES: Updates write project/section/chunk process state through repository.
PERSISTS: Delegated to repository adapter (in-memory bootstrap for now).
PRIMARY RISK: Coupling write logic with chat flow if boundaries are bypassed.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from uuid import uuid4

from anm_backend.adapters.llm_adapter import LLMAdapter
from anm_backend.audit import audit_log
from anm_backend.memory.memory_manager import MemoryManager
from anm_backend.write.contracts import WriteChunk, WriteChunkVersion, WriteProject, WriteReference, WriteSection
from anm_backend.write.repository import WriteWorkspaceRepository
from anm_backend.write.semantic_embeddings import DeterministicEmbeddingProvider

if TYPE_CHECKING:
    from anm_backend.services.write_summary_service import WriteSummaryService


def _sanitize_limit(limit: int) -> int:
    return max(1, min(int(limit), 100))


@dataclass
class WriteService:
    repository: WriteWorkspaceRepository
    llm_adapter: LLMAdapter
    memory_manager: MemoryManager
    summary_service: Optional["WriteSummaryService"] = None
    embedding_provider: DeterministicEmbeddingProvider = field(
        default_factory=lambda: DeterministicEmbeddingProvider(
            dimension=max(32, int(os.getenv("EMBEDDING_DIMENSION", "768"))),
            model_name=os.getenv("ANM_WRITE_EMBEDDING_MODEL", "deterministic-hash-embed-v1"),
        )
    )

    def list_projects(self, *, limit: int = 20) -> List[Dict[str, Any]]:
        projects = self.repository.list_projects(limit=_sanitize_limit(limit))
        return [self._project_summary_view(project) for project in projects]

    def create_project(
        self,
        *,
        title: str,
        objective: str,
        description: Optional[str] = None,
        session_id: Optional[str],
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        normalized_objective = (objective or "").strip() or (description or "").strip()
        created = self.repository.create_project(
            title=title,
            objective=normalized_objective,
            owner_session_id=session_id,
            metadata=metadata,
        )
        audit_log(
            component="write_service",
            event="write_project_created",
            payload={"project_id": created.project_id, "title": created.title},
            trace_id=trace_id,
        )
        return self._project_view(created)

    def update_project(
        self,
        *,
        project_id: str,
        title: Optional[str],
        objective: Optional[str],
        description: Optional[str],
        status: Optional[str],
        metadata: Optional[Dict[str, Any]],
        metadata_replace: bool,
    ) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        normalized_objective = objective if objective is not None else description
        updated = self.repository.update_project(
            project_id=project_id,
            title=title,
            objective=normalized_objective,
            status=status,
            metadata=metadata,
            metadata_replace=metadata_replace,
        )
        audit_log(
            component="write_service",
            event="write_project_updated",
            payload={"project_id": project_id},
            trace_id=trace_id,
        )
        return self._project_view(updated)

    def get_project(self, *, project_id: str) -> Dict[str, Any]:
        project = self.repository.get_project(project_id)
        if not project:
            raise KeyError("write project not found")
        return self._project_view(project)

    def list_project_sections(
        self,
        *,
        project_id: str,
        include_chunks: bool = True,
        include_summaries: bool = True,
    ) -> Dict[str, Any]:
        project = self.repository.get_project(project_id)
        if not project:
            raise KeyError("write project not found")
        sections = self.repository.list_project_sections(project_id=project_id)
        section_views = []
        for section in sections:
            view = self._section_view(section, include_chunks=include_chunks)
            if include_summaries:
                summary_row = self.repository.get_section_summary(section_id=section.section_id)
                view["summary_record"] = self._section_summary_compact(summary_row) if summary_row else None
            section_views.append(view)
        return {"project_id": project_id, "sections": section_views}

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
    ) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        section = self.repository.create_section(
            project_id=project_id,
            title=title,
            kind=kind,
            order=order,
            content=content,
            objective=objective,
            outline_notes=outline_notes,
            status=status,
        )
        audit_log(
            component="write_service",
            event="write_section_created",
            payload={
                "project_id": project_id,
                "section_id": section.section_id,
                "kind": section.kind,
                "status": section.status,
            },
            trace_id=trace_id,
        )
        return self._section_view(section)

    def update_section(
        self,
        *,
        section_id: str,
        title: Optional[str],
        objective: Optional[str],
        outline_notes: Optional[str],
        status: Optional[str],
        order: Optional[int],
    ) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        _, section = self.repository.update_section(
            section_id=section_id,
            title=title,
            objective=objective,
            outline_notes=outline_notes,
            status=status,
            order=order,
        )
        audit_log(
            component="write_service",
            event="write_section_updated",
            payload={"section_id": section_id},
            trace_id=trace_id,
        )
        return self._section_view(section)

    def insert_chunk(
        self,
        *,
        project_id: str,
        section_id: str,
        content: str,
        source_type: str = "user_inserted",
        role: str = "user",
        chunk_order: Optional[int] = None,
        version: int = 1,
        token_count: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        update_embedding: bool = True,
        summarize_section: bool = False,
        summarize_project: bool = False,
    ) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        normalized = content.strip()
        if not normalized:
            raise ValueError("content must not be empty")
        chunk = self.repository.append_chunk(
            project_id=project_id,
            section_id=section_id,
            role=role,
            text=normalized,
            metadata={"trace_id": trace_id, "source": "write_insert", **(metadata or {})},
            source_type=source_type,
            chunk_order=chunk_order,
            version=version,
            token_count=token_count,
        )

        if update_embedding:
            self.repository.upsert_draft_chunk_embedding(
                draft_chunk_id=chunk.chunk_id,
                embedding=self.embedding_provider.embed(chunk.text),
                embedding_model=self.embedding_provider.model_name,
            )

        section_summary_payload = None
        project_summary_payload = None
        if summarize_section:
            if not self.summary_service:
                raise RuntimeError("write_summary_service_unavailable")
            section_summary_payload = self.summary_service.summarize_section(section_id=section_id)
        if summarize_project:
            if not self.summary_service:
                raise RuntimeError("write_summary_service_unavailable")
            project_summary_payload = self.summary_service.summarize_project(project_id=project_id)

        self._refresh_process_summary(project_id=project_id)
        audit_log(
            component="write_service",
            event="write_chunk_inserted",
            payload={
                "project_id": project_id,
                "section_id": section_id,
                "chunk_id": chunk.chunk_id,
                "source_type": chunk.source_type,
                "update_embedding": update_embedding,
                "summarize_section": summarize_section,
                "summarize_project": summarize_project,
            },
            trace_id=trace_id,
        )
        return {
            "trace_id": trace_id,
            "project_id": project_id,
            "section_id": section_id,
            "chunk": self._chunk_view(chunk),
            "applied": {
                "update_embedding": bool(update_embedding),
                "summarize_section": bool(summarize_section),
                "summarize_project": bool(summarize_project),
            },
            "section_summary": section_summary_payload["summary"] if section_summary_payload else None,
            "project_summary": project_summary_payload["summary"] if project_summary_payload else None,
        }

    def get_chunk(self, *, chunk_id: str) -> Dict[str, Any]:
        chunk = self.repository.get_chunk(chunk_id=chunk_id)
        if not chunk:
            raise KeyError("write chunk not found")
        return self._chunk_view(chunk)

    def list_chunk_versions(self, *, chunk_id: str) -> Dict[str, Any]:
        chunk = self.repository.get_chunk(chunk_id=chunk_id)
        if not chunk:
            raise KeyError("write chunk not found")
        versions = self.repository.list_chunk_versions(chunk_id=chunk_id)
        return {
            "chunk_id": chunk_id,
            "versions": [self._chunk_version_view(item) for item in versions],
        }

    def update_chunk(
        self,
        *,
        chunk_id: str,
        content: str,
        edit_source: str,
        token_count: Optional[int],
        metadata: Optional[Dict[str, Any]],
        update_embedding: bool,
        summarize_section: bool,
        summarize_project: bool,
    ) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        normalized = content.strip()
        if not normalized:
            raise ValueError("content must not be empty")

        project, section, chunk, version_record = self.repository.edit_chunk(
            chunk_id=chunk_id,
            content=normalized,
            edit_source=edit_source,
            token_count=token_count,
            metadata={"trace_id": trace_id, "source": "write_chunk_edit", **(metadata or {})},
        )

        if update_embedding:
            self._reindex_chunk_embedding(chunk=chunk)

        section_summary_payload = None
        project_summary_payload = None
        if summarize_section:
            if not self.summary_service:
                raise RuntimeError("write_summary_service_unavailable")
            section_summary_payload = self.summary_service.summarize_section(section_id=section.section_id)
        if summarize_project:
            if not self.summary_service:
                raise RuntimeError("write_summary_service_unavailable")
            project_summary_payload = self.summary_service.summarize_project(project_id=project.project_id)

        self._refresh_process_summary(project_id=project.project_id)
        audit_log(
            component="write_service",
            event="write_chunk_updated",
            payload={
                "project_id": project.project_id,
                "section_id": section.section_id,
                "chunk_id": chunk.chunk_id,
                "chunk_version": chunk.version,
                "version_id": version_record.version_id,
                "edit_source": version_record.edit_source,
                "update_embedding": update_embedding,
                "summarize_section": summarize_section,
                "summarize_project": summarize_project,
            },
            trace_id=trace_id,
        )
        return {
            "trace_id": trace_id,
            "project_id": project.project_id,
            "section_id": section.section_id,
            "chunk": self._chunk_view(chunk),
            "version_record": self._chunk_version_view(version_record),
            "applied": {
                "update_embedding": bool(update_embedding),
                "summarize_section": bool(summarize_section),
                "summarize_project": bool(summarize_project),
            },
            "section_summary": section_summary_payload["summary"] if section_summary_payload else None,
            "project_summary": project_summary_payload["summary"] if project_summary_payload else None,
        }

    def autosave_chunk(
        self,
        *,
        chunk_id: str,
        content: str,
        client_version: int,
        autosave_reason: str,
        editor_session_id: Optional[str],
        client_timestamp: Optional[str],
        metadata: Optional[Dict[str, Any]],
        reindex_embedding: bool,
    ) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        normalized = content.strip()
        if not normalized:
            raise ValueError("content must not be empty")

        current_chunk = self.repository.get_chunk(chunk_id=chunk_id)
        if not current_chunk:
            raise KeyError("write chunk not found")
        if normalized == current_chunk.text.strip():
            audit_log(
                component="write_service",
                event="write_chunk_autosave_no_change",
                payload={
                    "chunk_id": chunk_id,
                    "project_id": current_chunk.project_id,
                    "section_id": current_chunk.section_id,
                    "client_version": int(client_version),
                    "server_version": int(current_chunk.version),
                    "autosave_reason": autosave_reason,
                    "editor_session_id": editor_session_id,
                },
                trace_id=trace_id,
            )
            return {
                "trace_id": trace_id,
                "chunk_id": chunk_id,
                "project_id": current_chunk.project_id,
                "section_id": current_chunk.section_id,
                "status": "no_change",
                "conflict": False,
                "client_version": int(client_version),
                "server_version": int(current_chunk.version),
                "server_updated_at": current_chunk.updated_at,
                "autosave_reason": autosave_reason,
                "editor_session_id": editor_session_id,
                "chunk": self._chunk_view(current_chunk),
                "version_record": None,
                "reindex_applied": False,
            }

        edit_metadata = {
            "trace_id": trace_id,
            "source": "write_chunk_autosave",
            "autosave_reason": autosave_reason,
            "editor_session_id": editor_session_id,
            "client_timestamp": client_timestamp,
            **(metadata or {}),
        }
        project, section, chunk, version_record = self.repository.edit_chunk(
            chunk_id=chunk_id,
            content=normalized,
            edit_source="system_edit",
            expected_version=int(client_version),
            token_count=None,
            metadata=edit_metadata,
        )

        if reindex_embedding:
            self._reindex_chunk_embedding(chunk=chunk)

        self._refresh_process_summary(project_id=project.project_id)
        audit_log(
            component="write_service",
            event="write_chunk_autosaved",
            payload={
                "chunk_id": chunk.chunk_id,
                "project_id": project.project_id,
                "section_id": section.section_id,
                "client_version": int(client_version),
                "server_version": int(chunk.version),
                "autosave_reason": autosave_reason,
                "editor_session_id": editor_session_id,
                "reindex_embedding": bool(reindex_embedding),
            },
            trace_id=trace_id,
        )
        return {
            "trace_id": trace_id,
            "chunk_id": chunk.chunk_id,
            "project_id": project.project_id,
            "section_id": section.section_id,
            "status": "saved",
            "conflict": False,
            "client_version": int(client_version),
            "server_version": int(chunk.version),
            "server_updated_at": chunk.updated_at,
            "autosave_reason": autosave_reason,
            "editor_session_id": editor_session_id,
            "chunk": self._chunk_view(chunk),
            "version_record": self._chunk_version_view(version_record),
            "reindex_applied": bool(reindex_embedding),
        }

    def reindex_chunk(self, *, chunk_id: str) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        chunk = self.repository.get_chunk(chunk_id=chunk_id)
        if not chunk:
            raise KeyError("write chunk not found")
        reindexed_at = self._reindex_chunk_embedding(chunk=chunk)
        audit_log(
            component="write_service",
            event="write_chunk_reindexed",
            payload={
                "chunk_id": chunk.chunk_id,
                "project_id": chunk.project_id,
                "section_id": chunk.section_id,
                "chunk_version": chunk.version,
                "embedding_model": self.embedding_provider.model_name,
            },
            trace_id=trace_id,
        )
        return {
            "trace_id": trace_id,
            "scope": "chunk",
            "project_id": chunk.project_id,
            "section_id": chunk.section_id,
            "chunk_id": chunk.chunk_id,
            "reindexed_chunk_ids": [chunk.chunk_id],
            "reindexed_count": 1,
            "failed_chunk_ids": [],
            "embedding_model": self.embedding_provider.model_name,
            "reindexed_at": reindexed_at,
        }

    def reindex_section(self, *, section_id: str) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        context = self.repository.get_section_context(section_id=section_id)
        if not context:
            raise KeyError("write section not found")
        project, section = context
        reindexed_ids: List[str] = []
        last_reindexed_at = section.updated_at
        for chunk in section.chunks:
            last_reindexed_at = self._reindex_chunk_embedding(chunk=chunk)
            reindexed_ids.append(chunk.chunk_id)
        audit_log(
            component="write_service",
            event="write_section_reindexed",
            payload={
                "project_id": project.project_id,
                "section_id": section.section_id,
                "reindexed_count": len(reindexed_ids),
                "embedding_model": self.embedding_provider.model_name,
            },
            trace_id=trace_id,
        )
        return {
            "trace_id": trace_id,
            "scope": "section",
            "project_id": project.project_id,
            "section_id": section.section_id,
            "chunk_id": None,
            "reindexed_chunk_ids": reindexed_ids,
            "reindexed_count": len(reindexed_ids),
            "failed_chunk_ids": [],
            "embedding_model": self.embedding_provider.model_name,
            "reindexed_at": last_reindexed_at,
        }

    def reindex_project(self, *, project_id: str) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        project = self.repository.get_project(project_id=project_id)
        if not project:
            raise KeyError("write project not found")
        reindexed_ids: List[str] = []
        last_reindexed_at = project.updated_at
        for chunk in self.repository.list_project_chunks(project_id=project_id):
            last_reindexed_at = self._reindex_chunk_embedding(chunk=chunk)
            reindexed_ids.append(chunk.chunk_id)
        audit_log(
            component="write_service",
            event="write_project_reindexed",
            payload={
                "project_id": project.project_id,
                "reindexed_count": len(reindexed_ids),
                "embedding_model": self.embedding_provider.model_name,
            },
            trace_id=trace_id,
        )
        return {
            "trace_id": trace_id,
            "scope": "project",
            "project_id": project.project_id,
            "section_id": None,
            "chunk_id": None,
            "reindexed_chunk_ids": reindexed_ids,
            "reindexed_count": len(reindexed_ids),
            "failed_chunk_ids": [],
            "embedding_model": self.embedding_provider.model_name,
            "reindexed_at": last_reindexed_at,
        }

    def add_process_memory(
        self,
        *,
        project_id: str,
        section_id: Optional[str],
        memory_type: str,
        title: str,
        content: str,
        priority: int,
        is_active: bool,
    ) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        item = self.repository.create_process_memory_item(
            project_id=project_id,
            section_id=section_id,
            memory_type=memory_type,
            title=title,
            content=content,
            priority=priority,
            is_active=is_active,
        )
        self.repository.upsert_process_memory_embedding(
            process_memory_id=item.memory_id,
            embedding=self.embedding_provider.embed(f"{item.title}\n{item.content}"),
            embedding_model=self.embedding_provider.model_name,
        )
        audit_log(
            component="write_service",
            event="write_process_memory_added",
            payload={
                "project_id": project_id,
                "section_id": section_id,
                "memory_id": item.memory_id,
                "memory_type": item.memory_type,
                "priority": item.priority,
                "is_active": item.is_active,
            },
            trace_id=trace_id,
        )
        return {
            "memory_id": item.memory_id,
            "project_id": item.project_id,
            "section_id": item.section_id,
            "memory_type": item.memory_type,
            "title": item.title,
            "content": item.content,
            "priority": item.priority,
            "is_active": item.is_active,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        }

    def attach_reference(
        self,
        *,
        project_id: str,
        document_id: int,
        source_path: str,
        note: str,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        trace_id = f"trace-{uuid4()}"
        reference = self.repository.attach_reference(
            project_id=project_id,
            document_id=document_id,
            source_path=source_path,
            note=note,
            metadata=metadata,
        )
        audit_log(
            component="write_service",
            event="write_reference_attached",
            payload={"project_id": project_id, "document_id": document_id},
            trace_id=trace_id,
        )
        return self._reference_view(reference)

    def assist_project(
        self,
        *,
        project_id: str,
        prompt: str,
        section_id: Optional[str],
        max_tokens: int,
        include_followup_prompt: bool,
    ) -> Dict[str, Any]:
        project = self.repository.get_project(project_id)
        if not project:
            raise KeyError("write project not found")

        target_section_id = section_id or self._resolve_default_section(project)
        if not target_section_id:
            created = self.repository.create_section(
                project_id=project_id,
                title="Rascunho",
                kind="draft",
                order=0,
                content="",
            )
            target_section_id = created.section_id

        trace_id = f"trace-{uuid4()}"
        token_cap = max(64, min(int(max_tokens), int(os.getenv("ANM_WRITE_MAX_TOKENS", "2048"))))
        response = self.llm_adapter.infer(
            user_input=prompt,
            context=self._build_write_context(project),
            hypotheses=[],
            readiness_state="WRITE",
            max_tokens=token_cap,
            temperature=0.18,
            top_p=0.88,
            style_hint=(
                "Modo escrita: resposta voltada a producao textual longa, mantendo coesao, "
                "continuidade de secoes e sem repetir blocos anteriores."
            ),
            include_followup_prompt=include_followup_prompt,
            trace_id=trace_id,
        )
        answer = response.text.strip()
        if not answer:
            raise RuntimeError("write_assist_empty_response")

        generated_chunk = self.repository.append_chunk(
            project_id=project_id,
            section_id=target_section_id,
            role="assistant",
            text=answer,
            metadata={"trace_id": trace_id, "source": "write_assist"},
        )
        self.repository.upsert_draft_chunk_embedding(
            draft_chunk_id=generated_chunk.chunk_id,
            embedding=self.embedding_provider.embed(generated_chunk.text),
            embedding_model=self.embedding_provider.model_name,
        )
        self._refresh_process_summary(project_id=project_id)
        audit_log(
            component="write_service",
            event="write_assist_generated",
            payload={"project_id": project_id, "section_id": target_section_id, "answer_chars": len(answer)},
            trace_id=trace_id,
        )
        return {
            "trace_id": trace_id,
            "project_id": project_id,
            "section_id": target_section_id,
            "answer": answer,
            "engine": {
                "model": response.model,
                "usage": response.usage,
            },
        }

    def get_process_memory(self, *, project_id: str) -> Dict[str, Any]:
        project = self.repository.get_project(project_id)
        if not project:
            raise KeyError("write project not found")
        process_memory_items = self.repository.list_process_memory_items(project_id=project_id)
        return {
            "status": project.status,
            "process_summary": project.process_summary,
            "sections": [
                {
                    "section_id": section.section_id,
                    "title": section.title,
                    "objective": section.objective,
                    "outline_notes": section.outline_notes,
                    "status": section.status,
                    "chunk_count": len(section.chunks),
                    "content_chars": len(section.content),
                    "updated_at": section.updated_at,
                }
                for section in project.sections
            ],
            "references": [
                {
                    "reference_id": reference.reference_id,
                    "document_id": reference.document_id,
                    "source_path": reference.source_path,
                    "note": reference.note,
                }
                for reference in project.references
            ],
            "items": [
                {
                    "memory_id": item.memory_id,
                    "section_id": item.section_id,
                    "memory_type": item.memory_type,
                    "title": item.title,
                    "content": item.content,
                    "priority": item.priority,
                    "is_active": item.is_active,
                    "updated_at": item.updated_at,
                }
                for item in process_memory_items
            ],
            "rag_ready": bool(project.references),
        }

    def _refresh_process_summary(self, *, project_id: str) -> None:
        project = self.repository.get_project(project_id)
        if not project:
            return
        section_count = len(project.sections)
        chunk_count = sum(len(section.chunks) for section in project.sections)
        refs_count = len(project.references)
        summary = (
            f"Projeto com {section_count} secao(oes), {chunk_count} chunk(s) de escrita "
            f"e {refs_count} referencia(s) de RAG vinculada(s)."
        )
        self.repository.update_process_summary(project_id=project_id, summary=summary)

    def _resolve_default_section(self, project: WriteProject) -> Optional[str]:
        if not project.sections:
            return None
        ordered = sorted(project.sections, key=lambda section: (section.order, section.updated_at))
        return ordered[0].section_id

    def _build_write_context(self, project: WriteProject) -> Dict[str, Any]:
        context_limit = max(4, min(int(os.getenv("ANM_WRITE_CONTEXT_LIMIT", "8")), 24))
        base_context = self.memory_manager.assemble_prompt_context(limit=context_limit)
        base_context["write_workspace"] = {
            "project_id": project.project_id,
            "title": project.title,
            "objective": project.objective,
            "process_summary": project.process_summary,
            "sections": [
                {
                    "section_id": section.section_id,
                    "title": section.title,
                    "kind": section.kind,
                    "order": section.order,
                    "objective": section.objective,
                    "outline_notes": section.outline_notes,
                    "status": section.status,
                    "content": section.content[-3500:],
                    "summary": section.summary,
                }
                for section in project.sections
            ],
            "references": [
                {
                    "reference_id": reference.reference_id,
                    "document_id": reference.document_id,
                    "source_path": reference.source_path,
                    "note": reference.note,
                }
                for reference in project.references
            ],
        }
        return base_context

    def _project_summary_view(self, project: WriteProject) -> Dict[str, Any]:
        return {
            "project_id": project.project_id,
            "title": project.title,
            "status": project.status,
            "updated_at": project.updated_at,
            "sections_count": len(project.sections),
            "references_count": len(project.references),
        }

    def _project_view(self, project: WriteProject) -> Dict[str, Any]:
        return {
            "project_id": project.project_id,
            "title": project.title,
            "description": project.objective,
            "objective": project.objective,
            "owner_session_id": project.owner_session_id,
            "status": project.status,
            "process_summary": project.process_summary,
            "metadata": dict(project.metadata),
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "sections": [self._section_view(section) for section in project.sections],
            "references": [self._reference_view(reference) for reference in project.references],
        }

    @staticmethod
    def _section_view(section: WriteSection, *, include_chunks: bool = True) -> Dict[str, Any]:
        payload = {
            "section_id": section.section_id,
            "project_id": section.project_id,
            "title": section.title,
            "kind": section.kind,
            "order": section.order,
            "objective": section.objective,
            "outline_notes": section.outline_notes,
            "status": section.status,
            "content": section.content,
            "summary": section.summary,
            "updated_at": section.updated_at,
        }
        payload["chunks"] = [WriteService._chunk_view(chunk) for chunk in section.chunks] if include_chunks else []
        return payload

    def _reindex_chunk_embedding(self, *, chunk: WriteChunk) -> str:
        row = self.repository.upsert_draft_chunk_embedding(
            draft_chunk_id=chunk.chunk_id,
            embedding=self.embedding_provider.embed(chunk.text),
            embedding_model=self.embedding_provider.model_name,
        )
        return row.created_at

    @staticmethod
    def _chunk_view(chunk: WriteChunk) -> Dict[str, Any]:
        return {
            "chunk_id": chunk.chunk_id,
            "project_id": chunk.project_id,
            "section_id": chunk.section_id,
            "role": chunk.role,
            "text": chunk.text,
            "source_type": chunk.source_type,
            "chunk_order": chunk.chunk_order,
            "version": chunk.version,
            "char_count": chunk.char_count,
            "token_count": chunk.token_count,
            "created_at": chunk.created_at,
            "updated_at": chunk.updated_at,
            "metadata": dict(chunk.metadata),
        }

    @staticmethod
    def _chunk_version_view(version: WriteChunkVersion) -> Dict[str, Any]:
        return {
            "version_id": version.version_id,
            "draft_chunk_id": version.draft_chunk_id,
            "project_id": version.project_id,
            "section_id": version.section_id,
            "version_number": version.version_number,
            "previous_version_id": version.previous_version_id,
            "content_snapshot": version.content_snapshot,
            "edit_source": version.edit_source,
            "created_at": version.created_at,
            "metadata": dict(version.metadata),
        }

    @staticmethod
    def _reference_view(reference: WriteReference) -> Dict[str, Any]:
        return {
            "reference_id": reference.reference_id,
            "document_id": reference.document_id,
            "source_path": reference.source_path,
            "note": reference.note,
            "metadata": dict(reference.metadata),
            "created_at": reference.created_at,
        }

    @staticmethod
    def _section_summary_compact(summary_row: Any) -> Dict[str, Any]:
        return {
            "summary_id": summary_row.summary_id,
            "project_id": summary_row.project_id,
            "section_id": summary_row.section_id,
            "summary": summary_row.summary,
            "summary_version": summary_row.summary_version,
            "source_chunk_count": summary_row.source_chunk_count,
            "last_chunk_id_processed": summary_row.last_chunk_id_processed,
            "created_at": summary_row.created_at,
            "updated_at": summary_row.updated_at,
        }
