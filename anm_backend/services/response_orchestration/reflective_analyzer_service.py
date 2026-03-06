"""
FILE: services/response_orchestration/reflective_analyzer_service.py
RESPONSIBILITY: Lightweight reflective checks across generated chunks.
FLOW ROLE: Detect coherence and precision issues before next generation step.
READS: Prompt, previous chunks and candidate chunk.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Heuristic checks may produce false positives.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _token_set(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]{3,}", _normalize(value).lower())}


def _jaccard(a: str, b: str) -> float:
    sa = _token_set(a)
    sb = _token_set(b)
    if not sa or not sb:
        return 0.0
    return float(len(sa & sb) / max(1, len(sa | sb)))


@dataclass
class ReflectiveReport:
    findings: List[str] = field(default_factory=list)
    coherence_alerts: List[str] = field(default_factory=list)
    precision_alerts: List[str] = field(default_factory=list)
    cross_text_similarity: float = 0.0


@dataclass
class ReflectiveAnalyzerService:
    def analyze(
        self,
        *,
        prompt_original: str,
        previous_chunks: List[str],
        candidate_chunk: str,
    ) -> ReflectiveReport:
        report = ReflectiveReport()
        candidate = _normalize(candidate_chunk)
        if not candidate:
            report.coherence_alerts.append("empty_candidate_chunk")
            return report

        if previous_chunks:
            similarity = _jaccard(previous_chunks[-1], candidate)
            report.cross_text_similarity = similarity
            if similarity >= 0.92:
                report.coherence_alerts.append("possible_structural_repetition_with_previous_chunk")
            elif similarity <= 0.04 and len(previous_chunks) >= 2:
                report.coherence_alerts.append("possible_topic_jump_without_transition")

        lowered = candidate.lower()
        if "sempre" in lowered and "nunca" in lowered:
            report.findings.append("potential_absolute_claim_conflict_in_same_chunk")
        if re.search(r"\b(coisa|negocio|bagunca)\b", lowered):
            report.precision_alerts.append("low_precision_terms_detected")
        if len(candidate.split()) < 25:
            report.precision_alerts.append("chunk_too_short_for_deep_progression")

        prompt_tokens = _token_set(prompt_original)
        if prompt_tokens and len(prompt_tokens & _token_set(candidate)) < 2:
            report.coherence_alerts.append("low_alignment_with_prompt_terms")
        return report
