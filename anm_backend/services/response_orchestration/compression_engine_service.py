"""
FILE: services/response_orchestration/compression_engine_service.py
RESPONSIBILITY: Progressive context compression between LLM calls.
FLOW ROLE: Keep rolling summary and compact operational state for long responses.
READS: Current session state and latest generated chunk/summary.
RAM WRITES: None directly (returns compressed artifacts for caller persistence).
PERSISTS: None.
PRIMARY RISK: Over-compression can hide relevant nuance.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List

from anm_backend.services.response_orchestration.types import SecondaryProcessMemoryState


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _truncate(value: str, *, max_chars: int) -> str:
    clean = _normalize(value)
    if len(clean) <= max_chars:
        return clean
    return clean[: max(8, max_chars - 3)].rstrip() + "..."


def _merge_unique(base: List[str], incoming: List[str], *, limit: int) -> List[str]:
    result: List[str] = []
    seen = set()
    for source in (base, incoming):
        for item in source:
            clean = _normalize(item)
            if not clean or clean in seen:
                continue
            seen.add(clean)
            result.append(clean)
            if len(result) >= max(1, limit):
                return result
    return result


@dataclass
class CompressionResult:
    rolling_summary: str
    compressed_state: Dict[str, Any]
    summary_sources: List[str]


@dataclass
class CompressionEngineService:
    def compress(
        self,
        *,
        session: SecondaryProcessMemoryState,
        latest_chunk: str,
        latest_summary: str,
        max_summary_chars: int = 900,
    ) -> CompressionResult:
        previous_sources = [item for item in session.chunk_summaries[-4:] if _normalize(item)]
        summary_sources = _merge_unique(previous_sources, [latest_summary], limit=6)
        if summary_sources:
            rolling_summary = _truncate(" | ".join(summary_sources), max_chars=max_summary_chars)
        else:
            rolling_summary = _truncate(latest_summary or latest_chunk, max_chars=max_summary_chars)

        semantic_state = {
            "completed_steps": list(session.completed_steps[-6:]),
            "pending_steps": list(session.pending_steps[:6]),
            "coverage": float(session.estimated_coverage),
            "depth_frontier": session.depth_frontier,
        }
        compressed_state: Dict[str, Any] = {
            "last_chunk": _truncate(latest_chunk, max_chars=260),
            "rolling_summary": rolling_summary,
            "semantic_state": semantic_state,
            "continuity_anchor": _truncate(session.continuation_anchor or session.continuity_bridge, max_chars=180),
            "segment_goal": _truncate(session.segment_goal or session.objective_current, max_chars=180),
        }
        return CompressionResult(
            rolling_summary=rolling_summary,
            compressed_state=compressed_state,
            summary_sources=summary_sources,
        )
