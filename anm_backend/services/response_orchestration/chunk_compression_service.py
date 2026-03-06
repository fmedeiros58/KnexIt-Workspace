"""
FILE: services/response_orchestration/chunk_compression_service.py
RESPONSIBILITY: Compress generated chunk into operational state signals.
FLOW ROLE: Preserve continuity-critical information between orchestration cycles.
READS: Generated chunk text and current secondary memory state.
RAM WRITES: None directly (returns compressed snapshot for state update).
PERSISTS: None.
PRIMARY RISK: Over-compression losing critical decisions.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _truncate(value: str, *, max_chars: int) -> str:
    clean = str(value or "").strip()
    if len(clean) <= max_chars:
        return clean
    return clean[: max(8, max_chars - 3)].rstrip() + "..."


def _split_sentences(text: str) -> List[str]:
    parts = re.split(r"(?<=[\.\!\?])\s+", str(text or "").strip())
    return [part.strip() for part in parts if part.strip()]


@dataclass
class ChunkCompressionSnapshot:
    summary: str
    key_claims: List[str] = field(default_factory=list)
    open_loops: List[str] = field(default_factory=list)
    continuity_bridge: str = ""
    forbidden_repetition_hints: List[str] = field(default_factory=list)


@dataclass
class ChunkCompressionService:
    def compress(self, *, chunk_text: str) -> ChunkCompressionSnapshot:
        normalized = _normalize(chunk_text)
        if not normalized:
            return ChunkCompressionSnapshot(summary="")

        sentences = _split_sentences(normalized)
        summary = _truncate(" ".join(sentences[:2]) if sentences else normalized, max_chars=320)

        key_claims: List[str] = []
        for sentence in sentences[:6]:
            clean = _truncate(sentence, max_chars=220)
            if len(clean) < 40:
                continue
            if clean not in key_claims:
                key_claims.append(clean)
            if len(key_claims) >= 4:
                break

        open_loops: List[str] = []
        loop_signals = (
            "a seguir",
            "na proxima",
            "resta",
            "falta",
            "sera detalhado",
            "será detalhado",
            "continua",
            "posteriormente",
        )
        lower_chunk = normalized.lower()
        if any(signal in lower_chunk for signal in loop_signals):
            open_loops.append(_truncate(summary, max_chars=180))

        continuity_bridge = _truncate(sentences[-1] if sentences else normalized, max_chars=220)
        forbidden = [_truncate(summary.lower(), max_chars=220)]

        return ChunkCompressionSnapshot(
            summary=summary,
            key_claims=key_claims,
            open_loops=open_loops,
            continuity_bridge=continuity_bridge,
            forbidden_repetition_hints=forbidden,
        )

