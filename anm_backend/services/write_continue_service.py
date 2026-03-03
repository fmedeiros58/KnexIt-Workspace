"""
FILE: services/write_continue_service.py
RESPONSIBILITY: Explicit continue-writing orchestration with anti-redundancy controls.
FLOW ROLE: Multi-layer retrieval -> prompt assembly -> generation -> persistence.
READS: Write repository state (projects/sections/chunks/summaries/process memory).
RAM WRITES: Embedding index updates and generated chunk payloads.
PERSISTS: Delegated to write repository.
PRIMARY RISK: Retrieval quality depends on embedding model quality and chunk hygiene.
"""

from __future__ import annotations

import os
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from anm_backend.adapters.llm_adapter import LLMAdapter
from anm_backend.audit import audit_log
from anm_backend.write.continue_prompt_builder import (
    ContinueWritingContextPack,
    ContinueWritingPromptBuilder,
    RetrievedChunkContext,
    RetrievedMemoryContext,
)
from anm_backend.write.contracts import WriteChunk, WriteProcessMemoryItem, WriteProject, WriteSection
from anm_backend.write.repository import WriteWorkspaceRepository
from anm_backend.write.semantic_embeddings import DeterministicEmbeddingProvider, cosine_similarity

_SECTION_HINT_RE = re.compile(r"(?:secao|section)\s+(\d+(?:\.\d+)*)", re.IGNORECASE)
_MULTI_BREAK_RE = re.compile(r"\n\s*\n+")
_VALID_SECTION_STATUS = {"planned", "drafting", "review", "done", "archived"}


def _sanitize_top_k(value: int, *, default: int, low: int, high: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(low, min(high, parsed))


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(char for char in normalized if not unicodedata.combining(char))


def _normalize_paragraph_window(min_paragraphs: int, max_paragraphs: int) -> Tuple[int, int]:
    floor = max(1, min(8, int(min_paragraphs)))
    ceil = max(1, min(8, int(max_paragraphs)))
    if floor > ceil:
        floor, ceil = ceil, floor
    return floor, ceil


def _normalize_generated_block(value: str, *, max_paragraphs: int) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    paragraphs = [part.strip() for part in _MULTI_BREAK_RE.split(text) if part.strip()]
    if len(paragraphs) <= max_paragraphs:
        return "\n\n".join(paragraphs)
    return "\n\n".join(paragraphs[:max_paragraphs]).strip()


@dataclass
class WriteContinueService:
    repository: WriteWorkspaceRepository
    llm_adapter: LLMAdapter
    prompt_builder: ContinueWritingPromptBuilder = field(default_factory=ContinueWritingPromptBuilder)
    embedding_provider: DeterministicEmbeddingProvider = field(
        default_factory=lambda: DeterministicEmbeddingProvider(
            dimension=max(32, int(os.getenv("EMBEDDING_DIMENSION", "768"))),
            model_name=os.getenv("ANM_WRITE_EMBEDDING_MODEL", "deterministic-hash-embed-v1"),
        )
    )

    def continue_writing(
        self,
        *,
        project_id: str,
        instruction: str,
        section_id: Optional[str],
        top_k_chunks: int,
        top_k_memories: int,
        min_paragraphs: int,
        max_paragraphs: int,
        max_tokens: int,
        temperature: float,
    ) -> Dict[str, Any]:
        project = self.repository.get_project(project_id)
        if not project:
            raise KeyError(f"write project not found: {project_id}")

        normalized_instruction = _normalize_text(instruction)
        if not normalized_instruction:
            raise ValueError("instruction must not be empty")

        target_section = self._resolve_target_section(project=project, explicit_section_id=section_id, instruction=normalized_instruction)
        if not target_section:
            raise KeyError(f"write section not found for project: {project_id}")

        paragraphs_min, paragraphs_max = _normalize_paragraph_window(min_paragraphs, max_paragraphs)
        top_chunks = _sanitize_top_k(top_k_chunks, default=6, low=1, high=20)
        top_memories = _sanitize_top_k(top_k_memories, default=6, low=1, high=20)
        token_cap = max(128, min(int(max_tokens), int(os.getenv("ANM_WRITE_CONTINUE_MAX_TOKENS", "2300"))))
        sampling_temperature = max(0.0, min(float(temperature), 1.0))

        self._ensure_project_embeddings(project_id=project.project_id)
        self._ensure_process_memory_embeddings(project_id=project.project_id)

        section_summary_row = self.repository.get_section_summary(section_id=target_section.section_id)
        project_summary_row = self.repository.get_project_global_summary(project_id=project.project_id)
        retrieval_query = self._build_retrieval_query(
            project=project,
            section=target_section,
            instruction=normalized_instruction,
            section_summary=section_summary_row.summary if section_summary_row else "",
            project_summary=project_summary_row.summary if project_summary_row else "",
        )
        query_embedding = self.embedding_provider.embed(retrieval_query)

        chunk_context = self._retrieve_similar_chunks(
            project_id=project.project_id,
            query_embedding=query_embedding,
            top_k=top_chunks,
        )
        memory_context = self._retrieve_relevant_process_memory(
            project_id=project.project_id,
            target_section_id=target_section.section_id,
            query_embedding=query_embedding,
            top_k=top_memories,
        )

        context_pack = ContinueWritingContextPack(
            project_id=project.project_id,
            project_title=project.title,
            project_objective=project.objective,
            target_section_id=target_section.section_id,
            target_section_title=target_section.title,
            target_section_order=target_section.order,
            target_section_status=target_section.status,
            target_section_objective=target_section.objective,
            target_section_outline_notes=target_section.outline_notes,
            instruction=normalized_instruction,
            section_summary=section_summary_row.summary if section_summary_row else None,
            project_global_summary=project_summary_row.summary if project_summary_row else None,
            retrieved_chunks=chunk_context,
            retrieved_memories=memory_context,
            paragraphs_min=paragraphs_min,
            paragraphs_max=paragraphs_max,
        )
        assembled_prompt = self.prompt_builder.build_prompt(context_pack)

        trace_id = f"trace-{uuid4()}"
        response = self._invoke_llm(
            prompt=assembled_prompt,
            trace_id=trace_id,
            max_tokens=token_cap,
            temperature=sampling_temperature,
        )
        normalized_chunk_text = _normalize_generated_block(response.text, max_paragraphs=paragraphs_max)
        if not normalized_chunk_text:
            raise RuntimeError("write_continue_empty_response")

        generated_chunk = self.repository.append_chunk(
            project_id=project.project_id,
            section_id=target_section.section_id,
            role="assistant",
            text=normalized_chunk_text,
            source_type="generated",
            token_count=response.usage.get("completion_tokens") if isinstance(response.usage, dict) else None,
            metadata={
                "trace_id": trace_id,
                "source": "write_continue",
                "retrieval_chunk_ids": [item.chunk_id for item in chunk_context],
                "retrieval_memory_ids": [item.memory_id for item in memory_context],
                "top_k_chunks": top_chunks,
                "top_k_memories": top_memories,
                "paragraph_window": {"min": paragraphs_min, "max": paragraphs_max},
            },
        )
        self.repository.upsert_draft_chunk_embedding(
            draft_chunk_id=generated_chunk.chunk_id,
            embedding=self.embedding_provider.embed(generated_chunk.text),
            embedding_model=self.embedding_provider.model_name,
        )

        audit_log(
            component="write_continue_service",
            event="write_continue_generated",
            payload={
                "project_id": project.project_id,
                "section_id": target_section.section_id,
                "chunk_id": generated_chunk.chunk_id,
                "retrieved_chunk_ids": [item.chunk_id for item in chunk_context],
                "retrieved_memory_ids": [item.memory_id for item in memory_context],
                "summary_section_id": section_summary_row.summary_id if section_summary_row else None,
                "summary_project_id": project_summary_row.summary_id if project_summary_row else None,
                "top_k_chunks": top_chunks,
                "top_k_memories": top_memories,
                "max_tokens": token_cap,
                "temperature": sampling_temperature,
            },
            trace_id=trace_id,
        )

        return {
            "trace_id": trace_id,
            "project_id": project.project_id,
            "section_id": target_section.section_id,
            "chunk": self._chunk_view(generated_chunk),
            "retrieved_chunk_ids": [item.chunk_id for item in chunk_context],
            "retrieved_memory_ids": [item.memory_id for item in memory_context],
            "section_summary_used": self._summary_section_view(section_summary_row) if section_summary_row else None,
            "project_global_summary_used": self._summary_project_view(project_summary_row) if project_summary_row else None,
            "top_k_applied": {"chunks": top_chunks, "memories": top_memories},
            "parameters": {
                "paragraphs_min": paragraphs_min,
                "paragraphs_max": paragraphs_max,
                "max_tokens": token_cap,
                "temperature": sampling_temperature,
                "embedding_model": self.embedding_provider.model_name,
                "prompt_builder": self.prompt_builder.__class__.__name__,
            },
        }

    def _invoke_llm(self, *, prompt: str, trace_id: str, max_tokens: int, temperature: float):
        engine_client = self.llm_adapter.engine_client
        system_prompt = (
            "Voce escreve em modo de continuidade de manuscrito. "
            "Responda apenas com o proximo bloco textual da secao alvo."
        )
        req = engine_client.build_request(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=0.9,
            trace_id=trace_id,
            metadata={"anm_write_flow": "continue_writing_v1"},
        )
        raw = engine_client.invoke(engine_client.engine_request_to_payload(req), trace_id=trace_id)
        return self.llm_adapter.response_parser.parse(raw, trace_id=trace_id)

    def _resolve_target_section(
        self,
        *,
        project: WriteProject,
        explicit_section_id: Optional[str],
        instruction: str,
    ) -> Optional[WriteSection]:
        ordered_sections = sorted(project.sections, key=lambda item: (item.order, item.updated_at))
        if explicit_section_id:
            for section in ordered_sections:
                if section.section_id == explicit_section_id:
                    return section
            raise KeyError(f"write section not found: {explicit_section_id}")

        section_hint_match = _SECTION_HINT_RE.search(instruction)
        if not section_hint_match:
            normalized_instruction = _strip_accents(instruction).lower()
            section_hint_match = _SECTION_HINT_RE.search(normalized_instruction)
        if section_hint_match:
            raw_hint = section_hint_match.group(1).strip().lower()
            for section in ordered_sections:
                title_lc = section.title.lower()
                if raw_hint in title_lc:
                    return section
            if raw_hint.isdigit():
                as_index = int(raw_hint)
                for section in ordered_sections:
                    if section.order == as_index:
                        return section
                if as_index > 0:
                    for section in ordered_sections:
                        if section.order == (as_index - 1):
                            return section

        for section in ordered_sections:
            if section.status in _VALID_SECTION_STATUS and section.status in {"planned", "drafting", "review"}:
                return section
        return ordered_sections[0] if ordered_sections else None

    def _ensure_project_embeddings(self, *, project_id: str) -> None:
        for chunk in self.repository.list_project_chunks(project_id=project_id):
            existing = self.repository.get_draft_chunk_embedding(draft_chunk_id=chunk.chunk_id)
            if existing:
                continue
            self.repository.upsert_draft_chunk_embedding(
                draft_chunk_id=chunk.chunk_id,
                embedding=self.embedding_provider.embed(chunk.text),
                embedding_model=self.embedding_provider.model_name,
            )

    def _ensure_process_memory_embeddings(self, *, project_id: str) -> None:
        for item in self.repository.list_process_memory_items(project_id=project_id, active_only=True):
            existing = self.repository.get_process_memory_embedding(process_memory_id=item.memory_id)
            if existing:
                continue
            source_text = f"{item.title}\n{item.content}"
            self.repository.upsert_process_memory_embedding(
                process_memory_id=item.memory_id,
                embedding=self.embedding_provider.embed(source_text),
                embedding_model=self.embedding_provider.model_name,
            )

    def _retrieve_similar_chunks(
        self,
        *,
        project_id: str,
        query_embedding: List[float],
        top_k: int,
    ) -> List[RetrievedChunkContext]:
        project = self.repository.get_project(project_id)
        if not project:
            return []
        candidates: List[RetrievedChunkContext] = []
        for chunk in self.repository.list_project_chunks(project_id=project_id):
            embedding = self.repository.get_draft_chunk_embedding(draft_chunk_id=chunk.chunk_id)
            if not embedding:
                continue
            score = cosine_similarity(query_embedding, embedding.embedding)
            candidates.append(
                RetrievedChunkContext(
                    chunk_id=chunk.chunk_id,
                    section_id=chunk.section_id,
                    chunk_order=chunk.chunk_order,
                    version=chunk.version,
                    similarity=score,
                    text=chunk.text,
                )
            )
        candidates.sort(key=lambda item: item.similarity, reverse=True)
        return candidates[:top_k]

    def _retrieve_relevant_process_memory(
        self,
        *,
        project_id: str,
        target_section_id: str,
        query_embedding: List[float],
        top_k: int,
    ) -> List[RetrievedMemoryContext]:
        scoped_items = self.repository.list_process_memory_items(
            project_id=project_id,
            section_id=target_section_id,
            active_only=True,
        )
        if not scoped_items:
            return []
        scored: List[RetrievedMemoryContext] = []
        for item in scoped_items:
            embedding = self.repository.get_process_memory_embedding(process_memory_id=item.memory_id)
            if not embedding:
                continue
            score = cosine_similarity(query_embedding, embedding.embedding)
            scored.append(
                RetrievedMemoryContext(
                    memory_id=item.memory_id,
                    memory_type=item.memory_type,
                    title=item.title,
                    content=item.content,
                    priority=item.priority,
                    similarity=score,
                )
            )
        scored.sort(key=lambda item: (item.similarity, item.priority), reverse=True)
        return scored[:top_k]

    def _build_retrieval_query(
        self,
        *,
        project: WriteProject,
        section: WriteSection,
        instruction: str,
        section_summary: str,
        project_summary: str,
    ) -> str:
        chunks_hint = " ".join(chunk.text for chunk in section.chunks[-3:])
        parts = [
            instruction,
            project.title,
            project.objective,
            section.title,
            section.objective,
            section.outline_notes,
            section_summary,
            project_summary,
            chunks_hint,
        ]
        return "\n".join(part for part in parts if _normalize_text(part))

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
    def _summary_section_view(summary_row) -> Dict[str, Any]:
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

    @staticmethod
    def _summary_project_view(summary_row) -> Dict[str, Any]:
        return {
            "summary_id": summary_row.summary_id,
            "project_id": summary_row.project_id,
            "summary": summary_row.summary,
            "summary_version": summary_row.summary_version,
            "source_chunk_count": summary_row.source_chunk_count,
            "created_at": summary_row.created_at,
            "updated_at": summary_row.updated_at,
        }
