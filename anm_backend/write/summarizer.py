"""
FILE: write/summarizer.py
RESPONSIBILITY: Deterministic summarization strategy for write workspace entities.
FLOW ROLE: Centralized synthesis logic used by write summary service.
READS: Project, section, chunks and stored section summaries.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Overly aggressive truncation can hide relevant details.
"""

from __future__ import annotations

import re
from typing import Dict, Iterable, List

from anm_backend.write.contracts import WriteProject, WriteSection, WriteSectionSummary

_SPLIT_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+|\n+")
_MULTISPACE_RE = re.compile(r"\s+")


def _normalize_text(value: str) -> str:
    return _MULTISPACE_RE.sub(" ", value or "").strip()


def _truncate(value: str, *, max_chars: int) -> str:
    text = _normalize_text(value)
    if len(text) <= max_chars:
        return text
    return text[: max(0, max_chars - 3)].rstrip() + "..."


def _extract_sentences(text: str) -> List[str]:
    normalized = _normalize_text(text)
    if not normalized:
        return []
    parts = [item.strip() for item in _SPLIT_SENTENCE_RE.split(normalized) if item.strip()]
    return parts


class DeterministicWriteSummarizer:
    def __init__(
        self,
        *,
        max_section_summary_chars: int = 1400,
        max_project_summary_chars: int = 2000,
        max_section_points: int = 4,
    ) -> None:
        self._max_section_summary_chars = max(280, int(max_section_summary_chars))
        self._max_project_summary_chars = max(600, int(max_project_summary_chars))
        self._max_section_points = max(1, int(max_section_points))

    def summarize_section(self, *, project: WriteProject, section: WriteSection) -> str:
        points = self._collect_section_points(_section_chunks_texts(section))
        lines: List[str] = [
            f"Secao '{section.title}' do projeto '{project.title}'.",
            f"Tipo: {section.kind}. Ordem: {section.order}. Chunks processados: {len(section.chunks)}.",
        ]
        if points:
            lines.append("Pontos principais:")
            for index, point in enumerate(points, start=1):
                lines.append(f"{index}. {point}")
        elif section.content.strip():
            lines.append(f"Conteudo atual: {_truncate(section.content, max_chars=420)}")
        else:
            lines.append("Sem conteudo consolidado ate o momento.")
        composed = "\n".join(lines)
        return _truncate(composed, max_chars=self._max_section_summary_chars)

    def summarize_project(
        self,
        *,
        project: WriteProject,
        section_summaries: Iterable[WriteSectionSummary],
    ) -> str:
        summaries_by_section_id: Dict[str, WriteSectionSummary] = {item.section_id: item for item in section_summaries}
        ordered_sections = sorted(project.sections, key=lambda section: (section.order, section.updated_at))
        total_chunks = sum(len(section.chunks) for section in ordered_sections)
        lines: List[str] = [
            f"Projeto '{project.title}' em status '{project.status}'.",
            f"Objetivo: {_truncate(project.objective or 'Nao informado.', max_chars=260)}",
            (
                f"Escopo atual: {len(ordered_sections)} secao(oes), {total_chunks} chunk(s), "
                f"{len(project.references)} referencia(s) associada(s)."
            ),
        ]

        if ordered_sections:
            lines.append("Panorama por secao:")
            for section in ordered_sections:
                stored = summaries_by_section_id.get(section.section_id)
                if stored:
                    excerpt = _truncate(stored.summary, max_chars=220)
                elif section.content.strip():
                    excerpt = _truncate(section.content, max_chars=220)
                else:
                    excerpt = "Sem resumo ainda."
                lines.append(f"- [{section.order}] {section.title}: {excerpt}")
        else:
            lines.append("Projeto sem secoes cadastradas.")

        composed = "\n".join(lines)
        return _truncate(composed, max_chars=self._max_project_summary_chars)

    def _collect_section_points(self, chunk_texts: Iterable[str]) -> List[str]:
        collected: List[str] = []
        seen = set()
        for text in chunk_texts:
            for sentence in _extract_sentences(text):
                point = _truncate(sentence, max_chars=220)
                if not point:
                    continue
                normalized_key = point.lower()
                if normalized_key in seen:
                    continue
                seen.add(normalized_key)
                collected.append(point)
                if len(collected) >= self._max_section_points:
                    return collected
        return collected


def _section_chunks_texts(section: WriteSection) -> List[str]:
    return [chunk.text for chunk in section.chunks if chunk.text.strip()]
