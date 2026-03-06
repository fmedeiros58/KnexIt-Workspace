"""
FILE: services/response_orchestration/paragraph_segmenter_service.py
RESPONSIBILITY: Phase 0 segmented paragraph strategy (1/2/3 coordinated calls).
FLOW ROLE: Decide lightweight segmented emission before advanced orchestration stages.
READS: Prompt/objective/context and orchestration request metadata.
RAM WRITES: None directly (returns plan adjustments consumed by orchestrator).
PERSISTS: None.
PRIMARY RISK: Misclassification can over-segment short answers.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, replace
from typing import List

from anm_backend.services.response_orchestration.config import (
    is_phase0_segmented_emission_enabled,
    phase0_auto_segmentation_enabled,
    resolve_phase0_density_medium_threshold,
    resolve_phase0_density_short_threshold,
    resolve_phase0_first_chunk_max_tokens,
    resolve_phase0_first_chunk_min_tokens,
    resolve_phase0_first_chunk_target_tokens,
    resolve_phase0_max_calls,
    resolve_phase0_per_call_max_tokens,
)
from anm_backend.services.response_orchestration.types import EmissionPlan, OrchestrationRequest

OPEN_SYNTAX_CONNECTORS: tuple[str, ...] = (
    "sobretudo quando",
    "na medida em que",
    "de modo que",
    "o que se intensifica quando",
    "especialmente em contextos nos quais",
    "considerando que",
    "uma vez que",
)

_COMPLEXITY_RE = re.compile(
    r"\b(analise|analyze|detalh|aprofund|compare|trade[- ]?off|arquitetura|metodologia|"
    r"implicac|consequenc|riscos?|causas?|efeitos?)\b",
    re.IGNORECASE,
)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _truncate(value: str, *, max_chars: int) -> str:
    clean = _normalize(value)
    if len(clean) <= max_chars:
        return clean
    return clean[: max(8, max_chars - 3)].rstrip() + "..."


def _estimate_context_density(payload: dict) -> float:
    try:
        rendered = json.dumps(payload or {}, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        rendered = str(payload or "")
    payload_chars = len(rendered.strip())
    return min(1.5, float(payload_chars) / 2500.0)


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


def _phase0_sections(call_count: int) -> List[str]:
    if call_count <= 1:
        return ["bloco_curto_unico"]
    if call_count == 2:
        return ["nucleo_argumentativo", "fechamento_continuo"]
    return ["nucleo_argumentativo", "expansao_continua", "fechamento_continuo"]


def _choose_connector(prompt: str, objective: str) -> str:
    joined = f"{prompt} {objective}".lower()
    if any(token in joined for token in ("causa", "efeito", "consequ", "risco")):
        return "na medida em que"
    if any(token in joined for token in ("compar", "trade-off", "tradeoff")):
        return "sobretudo quando"
    if "contexto" in joined:
        return "especialmente em contextos nos quais"
    return "sobretudo quando"


@dataclass
class ParagraphSegmentationDecision:
    enabled: bool
    call_count: int
    density_score: float
    segment_goal: str
    target_style: str
    join_rule: str
    open_connector: str
    first_chunk_min_tokens: int
    first_chunk_target_tokens: int
    first_chunk_max_tokens: int
    per_call_max_tokens: int
    rationale: List[str]


@dataclass
class ParagraphSegmenterService:
    def decide(self, *, request: OrchestrationRequest, base_plan: EmissionPlan) -> ParagraphSegmentationDecision:
        if not is_phase0_segmented_emission_enabled(request.mode):
            return ParagraphSegmentationDecision(
                enabled=False,
                call_count=1,
                density_score=0.0,
                segment_goal="",
                target_style="",
                join_rule="",
                open_connector="",
                first_chunk_min_tokens=0,
                first_chunk_target_tokens=0,
                first_chunk_max_tokens=0,
                per_call_max_tokens=0,
                rationale=["phase0_disabled_by_flag"],
            )

        metadata = dict(request.metadata or {})
        explicit_opt_in = bool(metadata.get("phase0_segmented_emission"))
        auto_enabled = phase0_auto_segmentation_enabled()
        if not explicit_opt_in and not auto_enabled:
            return ParagraphSegmentationDecision(
                enabled=False,
                call_count=1,
                density_score=0.0,
                segment_goal="",
                target_style="",
                join_rule="",
                open_connector="",
                first_chunk_min_tokens=0,
                first_chunk_target_tokens=0,
                first_chunk_max_tokens=0,
                per_call_max_tokens=0,
                rationale=["phase0_not_requested"],
            )

        prompt = _normalize(request.prompt_original)
        objective = _normalize(request.objective_current)
        words = [token for token in prompt.split(" ") if token]
        complexity_hits = len(_COMPLEXITY_RE.findall(prompt))
        context_density = _estimate_context_density(request.context_payload)
        density_score = (
            (float(len(words)) / 28.0)
            + (float(len(prompt)) / 240.0)
            + (float(complexity_hits) * 0.35)
            + context_density
            + (0.20 if request.prefer_multi_pass else 0.0)
        )

        short_threshold = resolve_phase0_density_short_threshold()
        medium_threshold = max(short_threshold + 0.05, resolve_phase0_density_medium_threshold())
        max_calls = resolve_phase0_max_calls()

        rationale: List[str] = [
            "phase0_requested_explicitly" if explicit_opt_in else "phase0_auto_enabled",
            f"density_score:{density_score:.3f}",
        ]

        if density_score < short_threshold:
            call_count = 1
            rationale.append("density_short_single_call")
        elif density_score < medium_threshold:
            call_count = 2
            rationale.append("density_medium_two_calls")
        else:
            call_count = 3
            rationale.append("density_high_three_calls")

        if request.prefer_multi_pass and call_count == 1:
            call_count = 2
            rationale.append("prefer_multi_pass_promoted_to_two_calls")

        respect_overrides = bool(metadata.get("phase0_respect_overrides")) if explicit_opt_in else True
        if respect_overrides:
            if request.max_cycles_override is not None:
                call_count = min(call_count, max(1, int(request.max_cycles_override)))
                rationale.append("respect_max_cycles_override")
            if request.min_cycles_override is not None:
                call_count = max(call_count, max(1, int(request.min_cycles_override)))
                rationale.append("respect_min_cycles_override")
        else:
            rationale.append("phase0_overrides_ignored")

        call_count = max(1, min(max_calls, call_count))

        per_call_max_tokens = min(resolve_phase0_per_call_max_tokens(), max(96, int(request.max_tokens)))
        first_chunk_min_tokens = min(resolve_phase0_first_chunk_min_tokens(), per_call_max_tokens)
        first_chunk_max_tokens = min(resolve_phase0_first_chunk_max_tokens(), per_call_max_tokens)
        if first_chunk_max_tokens < first_chunk_min_tokens:
            first_chunk_max_tokens = first_chunk_min_tokens
        first_chunk_target_tokens = max(
            first_chunk_min_tokens,
            min(resolve_phase0_first_chunk_target_tokens(), first_chunk_max_tokens),
        )

        connector = str(metadata.get("phase0_preferred_connector") or "").strip().lower()
        if connector not in OPEN_SYNTAX_CONNECTORS:
            connector = _choose_connector(prompt, objective)

        target_style = str(metadata.get("phase0_target_style") or "").strip()
        if not target_style:
            target_style = "analitico continuo" if request.mode == "write" else "analitico progressivo"

        segment_goal = _truncate(objective or prompt, max_chars=220)
        join_rule = "segunda chamada nao reinicia sujeito principal"

        return ParagraphSegmentationDecision(
            enabled=True,
            call_count=call_count,
            density_score=density_score,
            segment_goal=segment_goal,
            target_style=target_style,
            join_rule=join_rule,
            open_connector=connector,
            first_chunk_min_tokens=first_chunk_min_tokens,
            first_chunk_target_tokens=first_chunk_target_tokens,
            first_chunk_max_tokens=first_chunk_max_tokens,
            per_call_max_tokens=per_call_max_tokens,
            rationale=rationale,
        )

    def apply_to_plan(self, *, base_plan: EmissionPlan, decision: ParagraphSegmentationDecision) -> EmissionPlan:
        if not decision.enabled:
            return base_plan

        call_count = max(1, int(decision.call_count))
        response_mode = "multi_pass" if call_count > 1 else "single_pass"
        should_use_multi_pass = call_count > 1
        min_cycles_required = call_count if should_use_multi_pass else 1
        planned_sections = _phase0_sections(call_count)
        target_chunk_tokens = max(96, min(int(decision.first_chunk_target_tokens), int(decision.per_call_max_tokens)))
        max_total_tokens = max(
            256,
            min(
                int(base_plan.max_total_response_tokens),
                (int(decision.per_call_max_tokens) * call_count) + 128,
            ),
        )

        updated_rationale = _merge_unique(
            list(base_plan.rationale),
            list(decision.rationale),
            limit=24,
        )
        return replace(
            base_plan,
            response_mode=response_mode,
            should_use_multi_pass=should_use_multi_pass,
            planned_sections=planned_sections,
            max_cycles=call_count,
            target_chunk_tokens=target_chunk_tokens,
            max_total_response_tokens=max_total_tokens,
            min_cycles_required=min_cycles_required,
            rationale=updated_rationale,
            phase0_enabled=True,
            phase0_call_count=call_count,
            phase0_segment_goal=decision.segment_goal,
            phase0_target_style=decision.target_style,
            phase0_join_rule=decision.join_rule,
            phase0_open_connector=decision.open_connector,
            phase0_first_chunk_min_tokens=decision.first_chunk_min_tokens,
            phase0_first_chunk_max_tokens=decision.first_chunk_max_tokens,
            phase0_per_call_max_tokens=decision.per_call_max_tokens,
        )
