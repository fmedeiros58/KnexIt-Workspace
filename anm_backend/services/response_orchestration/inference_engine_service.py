"""
FILE: services/response_orchestration/inference_engine_service.py
RESPONSIBILITY: Suggest missing aspects and expansion opportunities.
FLOW ROLE: Infer gaps between prompt intent and current compressed response state.
READS: Prompt, rolling summary, next intent and open loops.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Heuristic suggestions may over-generalize.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _keywords(value: str) -> List[str]:
    tokens = re.findall(r"[a-z0-9]{4,}", _normalize(value).lower())
    return [token for token in tokens if token not in {"para", "como", "sobre", "entre", "mais", "menos"}]


@dataclass
class InferenceMap:
    suggestions: List[str] = field(default_factory=list)
    gaps: List[str] = field(default_factory=list)
    expansion_opportunities: List[str] = field(default_factory=list)
    latent_topics: List[str] = field(default_factory=list)


@dataclass
class InferenceEngineService:
    def infer(
        self,
        *,
        prompt_original: str,
        rolling_summary: str,
        next_intent: str,
        open_loops: List[str],
    ) -> InferenceMap:
        prompt_keys = _keywords(prompt_original)[:10]
        summary_keys = set(_keywords(rolling_summary))
        missing = [key for key in prompt_keys if key not in summary_keys][:4]

        inference = InferenceMap()
        if missing:
            inference.gaps = [f"aspecto_ainda_nao_coberto:{item}" for item in missing]
            inference.suggestions = [f"expandir aspecto '{item}' no proximo bloco" for item in missing[:3]]
        if next_intent:
            inference.expansion_opportunities.append(f"aprofundar_intencao:{_normalize(next_intent)}")
        if open_loops:
            inference.expansion_opportunities.append("resolver_open_loops_pendentes")

        latent_candidates = [key for key in prompt_keys if key not in missing][:3]
        inference.latent_topics = [f"topico_latente:{item}" for item in latent_candidates]
        return inference
