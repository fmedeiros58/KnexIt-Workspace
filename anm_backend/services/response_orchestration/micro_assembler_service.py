"""
FILE: services/response_orchestration/micro_assembler_service.py
RESPONSIBILITY: Merge segmented Phase 0 outputs into one fluent paragraph.
FLOW ROLE: Remove visible stitching and smooth boundary between short calls.
READS: First and continuation chunks plus anchor/join hints.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Excessive cleanup can remove valid rhetorical transitions.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _remove_prefix_case_insensitive(text: str, prefix: str) -> str:
    normalized_text = _normalize(text)
    normalized_prefix = _normalize(prefix)
    if not normalized_prefix:
        return normalized_text
    if normalized_text.lower().startswith(normalized_prefix.lower()):
        return normalized_text[len(normalized_prefix):].lstrip(" ,;:-")
    return normalized_text


def _words(value: str) -> list[str]:
    return [token for token in _normalize(value).split(" ") if token]


def _trim_repeated_boundary(first_chunk: str, second_chunk: str) -> str:
    first_words = _words(first_chunk)
    second_words = _words(second_chunk)
    if not first_words or not second_words:
        return _normalize(second_chunk)

    max_probe = min(8, len(first_words), len(second_words))
    for size in range(max_probe, 2, -1):
        tail = " ".join(first_words[-size:]).lower()
        head = " ".join(second_words[:size]).lower()
        if tail == head:
            return " ".join(second_words[size:]).strip()
    return _normalize(second_chunk)


@dataclass
class MicroAssemblerService:
    def assemble_paragraph(
        self,
        *,
        first_chunk: str,
        continuation_chunk: str,
        continuation_anchor: str,
        join_rule: str,
    ) -> str:
        del join_rule  # join rule is enforced by cleanup heuristics.

        first = _normalize(first_chunk)
        second = _normalize(continuation_chunk)
        if not first:
            return second
        if not second:
            return first

        # Remove explicit restart markers at beginning of continuation.
        for prefix in (
            "em resumo",
            "em sintese",
            "primeiramente",
            "para concluir",
            "concluindo",
            "retomando do inicio",
            "reiniciando",
        ):
            second = _remove_prefix_case_insensitive(second, prefix)

        # Avoid duplicated connector/anchor at boundary.
        second = _remove_prefix_case_insensitive(second, continuation_anchor)
        second = _trim_repeated_boundary(first, second)
        if not second:
            merged = first
        else:
            merged = f"{first} {second}".strip()

        merged = re.sub(r"\s+([,.;:!?])", r"\1", merged)
        merged = re.sub(r"([,.;:!?]){2,}", r"\1", merged)
        merged = re.sub(r"\s{2,}", " ", merged).strip()
        return merged

    def assemble_sequence(
        self,
        *,
        partial_chunks: List[str],
        continuation_anchor: str,
        join_rule: str,
    ) -> str:
        normalized_chunks = [_normalize(chunk) for chunk in list(partial_chunks or []) if _normalize(chunk)]
        if not normalized_chunks:
            return ""
        merged = normalized_chunks[0]
        for idx, chunk in enumerate(normalized_chunks[1:], start=2):
            merged = self.assemble_paragraph(
                first_chunk=merged,
                continuation_chunk=chunk,
                continuation_anchor=continuation_anchor if idx == 2 else "",
                join_rule=join_rule,
            )
        return _normalize(merged)
