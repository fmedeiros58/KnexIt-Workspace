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

from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple
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
            "summary": self._section_summary_view(summary, stale=False, stale_reasons=[]),
        }

    def get_section_summary(self, *, section_id: str) -> Dict[str, Any]:
        summary = self.repository.get_section_summary(section_id=section_id)
        if not summary:
            raise KeyError(f"write section summary not found: {section_id}")
        stale, stale_reasons = self.section_summary_staleness(section_id=section_id)
        return self._section_summary_view(summary, stale=stale, stale_reasons=stale_reasons)

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
            "summary": self._project_summary_view(summary, stale=False, stale_reasons=[]),
        }

    def get_project_summary(self, *, project_id: str) -> Dict[str, Any]:
        summary = self.repository.get_project_global_summary(project_id=project_id)
        if not summary:
            raise KeyError(f"write project summary not found: {project_id}")
        stale, stale_reasons = self.project_summary_staleness(project_id=project_id)
        return self._project_summary_view(summary, stale=stale, stale_reasons=stale_reasons)

    def section_summary_staleness(self, *, section_id: str) -> Tuple[bool, List[str]]:
        context = self.repository.get_section_context(section_id=section_id)
        if not context:
            raise KeyError(f"write section not found: {section_id}")
        _, section = context
        summary = self.repository.get_section_summary(section_id=section_id)
        if not summary:
            return True, ["missing_summary"]

        reasons: List[str] = []
        if summary.source_chunk_count != len(section.chunks):
            reasons.append("chunk_count_changed")
        latest_chunk_id = section.chunks[-1].chunk_id if section.chunks else None
        if summary.last_chunk_id_processed != latest_chunk_id:
            reasons.append("last_chunk_pointer_changed")
        if any(_parse_timestamp(chunk.updated_at) > _parse_timestamp(summary.updated_at) for chunk in section.chunks):
            reasons.append("chunk_updated_after_summary")
        return (len(reasons) > 0), reasons

    def project_summary_staleness(self, *, project_id: str) -> Tuple[bool, List[str]]:
        project = self.repository.get_project(project_id=project_id)
        if not project:
            raise KeyError(f"write project not found: {project_id}")
        summary = self.repository.get_project_global_summary(project_id=project_id)
        if not summary:
            return True, ["missing_summary"]

        reasons: List[str] = []
        total_chunks = sum(len(section.chunks) for section in project.sections)
        if summary.source_chunk_count != total_chunks:
            reasons.append("project_chunk_count_changed")
        summary_updated_at = _parse_timestamp(summary.updated_at)
        if any(_parse_timestamp(chunk.updated_at) > summary_updated_at for section in project.sections for chunk in section.chunks):
            reasons.append("chunk_updated_after_project_summary")

        section_summaries = self.repository.list_section_summaries(project_id=project_id)
        section_summary_by_id = {item.section_id: item for item in section_summaries}
        for section in project.sections:
            row = section_summary_by_id.get(section.section_id)
            if not row:
                reasons.append(f"section_summary_missing:{section.section_id}")
                continue
            if _parse_timestamp(row.updated_at) > summary_updated_at:
                reasons.append(f"section_summary_newer_than_project:{section.section_id}")
        return (len(reasons) > 0), reasons

    @staticmethod
    def _section_summary_view(summary: WriteSectionSummary, *, stale: bool, stale_reasons: List[str]) -> Dict[str, Any]:
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
            "is_stale": bool(stale),
            "stale_reasons": list(stale_reasons),
        }

    @staticmethod
    def _project_summary_view(summary: WriteProjectGlobalSummary, *, stale: bool, stale_reasons: List[str]) -> Dict[str, Any]:
        return {
            "summary_id": summary.summary_id,
            "project_id": summary.project_id,
            "summary": summary.summary,
            "summary_version": summary.summary_version,
            "source_chunk_count": summary.source_chunk_count,
            "created_at": summary.created_at,
            "updated_at": summary.updated_at,
            "is_stale": bool(stale),
            "stale_reasons": list(stale_reasons),
        }


def _parse_timestamp(value: str) -> datetime:
    raw = str(value or "").strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
