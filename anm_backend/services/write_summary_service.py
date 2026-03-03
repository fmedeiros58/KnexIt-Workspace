"""
FILE: services/write_summary_service.py
RESPONSIBILITY: Explicit summary orchestration for write workspace projects/sections.
FLOW ROLE: Synchronous recalculation and retrieval of section/global summaries.
READS: Write repository state (projects, sections, chunks and summary records).
RAM WRITES: Summary versions and timestamps through repository upserts.
PERSISTS: Delegated to repository adapter.
PRIMARY RISK: Summary drift if summarizer strategy changes without version governance.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict
from uuid import uuid4

from anm_backend.audit import audit_log
from anm_backend.write.contracts import WriteProjectGlobalSummary, WriteSectionSummary
from anm_backend.write.repository import WriteWorkspaceRepository
from anm_backend.write.summarizer import DeterministicWriteSummarizer


@dataclass
class WriteSummaryService:
    repository: WriteWorkspaceRepository
    summarizer: DeterministicWriteSummarizer = field(default_factory=DeterministicWriteSummarizer)

    def summarize_section(self, *, section_id: str) -> Dict[str, Any]:
        context = self.repository.get_section_context(section_id=section_id)
        if not context:
            raise KeyError(f"write section not found: {section_id}")
        project, section = context

        summary_text = self.summarizer.summarize_section(project=project, section=section)
        source_chunk_count = len(section.chunks)
        last_chunk_id = section.chunks[-1].chunk_id if section.chunks else None
        summary, updated = self.repository.upsert_section_summary(
            project_id=project.project_id,
            section_id=section.section_id,
            summary=summary_text,
            source_chunk_count=source_chunk_count,
            last_chunk_id_processed=last_chunk_id,
        )
        trace_id = f"trace-{uuid4()}"
        audit_log(
            component="write_summary_service",
            event="write_section_summary_recalculated",
            payload={
                "project_id": project.project_id,
                "section_id": section.section_id,
                "updated": updated,
                "summary_version": summary.summary_version,
                "source_chunk_count": summary.source_chunk_count,
            },
            trace_id=trace_id,
        )
        return {
            "updated": updated,
            "trace_id": trace_id,
            "summary": self._section_summary_view(summary),
        }

    def get_section_summary(self, *, section_id: str) -> Dict[str, Any]:
        summary = self.repository.get_section_summary(section_id=section_id)
        if not summary:
            raise KeyError(f"write section summary not found: {section_id}")
        return self._section_summary_view(summary)

    def summarize_project(self, *, project_id: str) -> Dict[str, Any]:
        project = self.repository.get_project(project_id=project_id)
        if not project:
            raise KeyError(f"write project not found: {project_id}")

        section_summaries = self.repository.list_section_summaries(project_id=project_id)
        summary_text = self.summarizer.summarize_project(project=project, section_summaries=section_summaries)
        source_chunk_count = sum(len(section.chunks) for section in project.sections)
        summary, updated = self.repository.upsert_project_global_summary(
            project_id=project_id,
            summary=summary_text,
            source_chunk_count=source_chunk_count,
        )
        trace_id = f"trace-{uuid4()}"
        audit_log(
            component="write_summary_service",
            event="write_project_global_summary_recalculated",
            payload={
                "project_id": project_id,
                "updated": updated,
                "summary_version": summary.summary_version,
                "source_chunk_count": summary.source_chunk_count,
            },
            trace_id=trace_id,
        )
        return {
            "updated": updated,
            "trace_id": trace_id,
            "summary": self._project_summary_view(summary),
        }

    def get_project_summary(self, *, project_id: str) -> Dict[str, Any]:
        summary = self.repository.get_project_global_summary(project_id=project_id)
        if not summary:
            raise KeyError(f"write project summary not found: {project_id}")
        return self._project_summary_view(summary)

    @staticmethod
    def _section_summary_view(summary: WriteSectionSummary) -> Dict[str, Any]:
        return {
            "summary_id": summary.summary_id,
            "project_id": summary.project_id,
            "section_id": summary.section_id,
            "summary": summary.summary,
            "summary_version": summary.summary_version,
            "source_chunk_count": summary.source_chunk_count,
            "last_chunk_id_processed": summary.last_chunk_id_processed,
            "created_at": summary.created_at,
            "updated_at": summary.updated_at,
        }

    @staticmethod
    def _project_summary_view(summary: WriteProjectGlobalSummary) -> Dict[str, Any]:
        return {
            "summary_id": summary.summary_id,
            "project_id": summary.project_id,
            "summary": summary.summary,
            "summary_version": summary.summary_version,
            "source_chunk_count": summary.source_chunk_count,
            "created_at": summary.created_at,
            "updated_at": summary.updated_at,
        }
