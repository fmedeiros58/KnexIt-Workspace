"""
FILE: services/response_orchestration/emission_planner_service.py
RESPONSIBILITY: Decide single-pass vs multi-pass response strategy.
FLOW ROLE: Build explicit emission plan before generation cycles.
READS: Prompt, mode, context hints and orchestration limits.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Over-triggering multi-pass for trivial prompts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

from anm_backend.services.response_orchestration.config import (
    resolve_max_total_response_tokens,
    resolve_mode_max_cycles,
    resolve_target_chunk_tokens,
)
from anm_backend.services.response_orchestration.types import EmissionPlan, OrchestrationRequest

_COMPLEXITY_PATTERNS = (
    r"\b(analise|analyze|compar[ea]|estrutur[ea]|aprofund[ea]|detalh[ea]|argument[ea])\b",
    r"\b(passo a passo|step by step|trade[- ]?off|arquitetura|metodologia)\b",
    r"\b(continue|continuar|expanda|expandir|sintetize|consolidar)\b",
)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _split_prompt_sections(prompt: str, *, limit: int) -> List[str]:
    normalized = str(prompt or "").strip()
    if not normalized:
        return ["resposta principal"]
    raw_parts = re.split(r"[.;\n]+", normalized)
    sections = []
    for part in raw_parts:
        clean = re.sub(r"\s+", " ", part).strip()
        if not clean:
            continue
        if len(clean) > 120:
            clean = clean[:117].rstrip() + "..."
        sections.append(clean)
        if len(sections) >= max(1, limit):
            break
    if not sections:
        return ["resposta principal"]
    return sections


def _resolve_adaptive_min_cycles(*, mode: str, complexity_score: float, max_cycles: int, prefer_multi_pass: bool) -> int:
    if mode != "chat":
        return 1
    if max_cycles <= 1:
        return 1

    if not prefer_multi_pass and complexity_score < 1.2:
        return 1

    if complexity_score >= 2.10:
        desired = 8
    elif complexity_score >= 1.75:
        desired = 7
    elif complexity_score >= 1.35:
        desired = 6
    elif complexity_score >= 1.00:
        desired = 5
    else:
        desired = 4
    return max(1, min(max_cycles, desired))


def _expand_sections_to_cycles(sections: List[str], *, max_cycles: int, min_cycles_required: int) -> List[str]:
    base = [re.sub(r"\s+", " ", str(item or "").strip()) for item in sections]
    base = [item for item in base if item]
    if not base:
        base = ["resposta principal"]

    if len(base) < min_cycles_required:
        fallback_steps = [
            "contextualizacao e definicoes",
            "mecanismos e fundamentos",
            "implicacoes e aplicacoes",
            "riscos e limites",
            "sintese integrada",
            "proximos passos praticos",
        ]
        for step in fallback_steps:
            if len(base) >= min_cycles_required:
                break
            if step in base:
                continue
            base.append(step)
    while len(base) < min_cycles_required:
        base.append(f"aprofundamento_{len(base) + 1}")
    return base[: max(1, max_cycles)]


@dataclass
class EmissionPlannerService:
    def plan(self, *, request: OrchestrationRequest, orchestration_enabled: bool) -> EmissionPlan:
        normalized_prompt = _normalize(request.prompt_original)
        prompt_words = [token for token in normalized_prompt.split(" ") if token]

        complexity_score = 0.0
        rationale: List[str] = []

        if len(prompt_words) >= 40:
            complexity_score += 0.75
            rationale.append("prompt_word_count_high")
        if len(normalized_prompt) >= 320:
            complexity_score += 0.55
            rationale.append("prompt_char_count_high")
        for pattern in _COMPLEXITY_PATTERNS:
            if re.search(pattern, normalized_prompt, re.IGNORECASE):
                complexity_score += 0.45
                rationale.append(f"pattern:{pattern}")
        if request.mode == "write":
            complexity_score += 0.45
            rationale.append("mode_write_bias")
        if request.prefer_multi_pass:
            complexity_score += 0.65
            rationale.append("request_prefers_multi_pass")
        if request.context_payload:
            complexity_score += 0.10
            rationale.append("context_payload_present")

        max_cycles_cfg = resolve_mode_max_cycles(request.mode)
        if request.max_cycles_override is not None:
            max_cycles_cfg = max(1, min(int(request.max_cycles_override), 8))
        min_cycles_required = _resolve_adaptive_min_cycles(
            mode=request.mode,
            complexity_score=complexity_score,
            max_cycles=max_cycles_cfg,
            prefer_multi_pass=bool(request.prefer_multi_pass),
        )
        if request.min_cycles_override is not None:
            min_cycles_required = max(1, min(int(request.min_cycles_override), max_cycles_cfg))

        target_chunk_tokens = resolve_target_chunk_tokens()
        if request.target_chunk_tokens_override is not None:
            target_chunk_tokens = max(80, min(int(request.target_chunk_tokens_override), 4096))
        target_chunk_tokens = min(target_chunk_tokens, max(96, int(request.max_tokens)))

        max_total_response_tokens = resolve_max_total_response_tokens()
        if request.max_total_response_tokens_override is not None:
            max_total_response_tokens = max(256, min(int(request.max_total_response_tokens_override), 32768))
        max_total_response_tokens = max(
            min(max_total_response_tokens, max(256, int(request.max_tokens) * 4)),
            max(256, int(request.max_tokens)),
        )

        should_use_multi = bool(
            orchestration_enabled
            and max_cycles_cfg > 1
            and (complexity_score >= 1.20 or request.prefer_multi_pass)
        )
        if should_use_multi:
            sections = request.planner_hints or _split_prompt_sections(request.prompt_original, limit=max_cycles_cfg)
            planned_sections = _expand_sections_to_cycles(
                sections,
                max_cycles=max_cycles_cfg,
                min_cycles_required=min_cycles_required,
            )
            if request.prefer_multi_pass:
                rationale.append("prefer_multi_pass_forced")
            if min_cycles_required > 1:
                rationale.append(f"min_cycles_required:{min_cycles_required}")
            return EmissionPlan(
                response_mode="multi_pass",
                should_use_multi_pass=True,
                complexity_score=complexity_score,
                planned_sections=planned_sections,
                max_cycles=max_cycles_cfg,
                target_chunk_tokens=target_chunk_tokens,
                max_total_response_tokens=max_total_response_tokens,
                min_cycles_required=min_cycles_required,
                rationale=rationale or ["multi_pass_selected"],
            )

        return EmissionPlan(
            response_mode="single_pass",
            should_use_multi_pass=False,
            complexity_score=complexity_score,
            planned_sections=request.planner_hints[:1] if request.planner_hints else ["resposta principal"],
            max_cycles=1,
            target_chunk_tokens=min(target_chunk_tokens, max(96, int(request.max_tokens))),
            max_total_response_tokens=max(256, int(request.max_tokens)),
            min_cycles_required=1,
            rationale=rationale or ["single_pass_selected"],
        )
