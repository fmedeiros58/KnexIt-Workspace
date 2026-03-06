"""
FILE: services/response_orchestration/chunk_generation_service.py
RESPONSIBILITY: Generate single-pass or cycle chunks for orchestration.
FLOW ROLE: Centralize internal prompt assembly and LLM invocation per cycle.
READS: Emission plan, secondary memory state and filtered principal context.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Prompt bloat if context packing is not constrained.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict

from anm_backend.adapters.llm_adapter import LLMAdapter
from anm_backend.contracts import EngineResponse
from anm_backend.services.response_orchestration.config import resolve_continuity_summary_max_tokens
from anm_backend.services.response_orchestration.paragraph_segmenter_service import OPEN_SYNTAX_CONNECTORS
from anm_backend.services.response_orchestration.types import (
    EmissionPlan,
    GenerationRequest,
    OrchestrationRequest,
    SecondaryProcessMemoryState,
)
from anm_backend.utils import describe_language, detect_user_language


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _truncate(value: str, *, max_chars: int) -> str:
    clean = str(value or "").strip()
    if len(clean) <= max_chars:
        return clean
    return clean[: max(8, max_chars - 3)].rstrip() + "..."


def _should_use_system_role() -> bool:
    return str(os.getenv("ANM_ENGINE_USE_SYSTEM_ROLE", "0")).strip().lower() in {"1", "true", "yes", "on"}


def _extract_completion_tokens(response: EngineResponse) -> int:
    usage = dict(response.usage or {})
    for key in ("completion_tokens", "output_tokens", "tokens"):
        try:
            value = int(usage.get(key))
            if value > 0:
                return value
        except (TypeError, ValueError):
            continue
    return max(16, int(len(response.text or "") / 4))


@dataclass
class ChunkGenerationService:
    llm_adapter: LLMAdapter

    def generate_single_pass(
        self,
        *,
        request: OrchestrationRequest,
        plan: EmissionPlan,
        trace_id: str,
    ) -> EngineResponse:
        response_language = detect_user_language(request.prompt_original)
        if request.single_pass_generator is not None:
            return request.single_pass_generator(
                GenerationRequest(
                    prompt=request.prompt_original,
                    mode=request.mode,
                    response_mode="single_pass",
                    trace_id=trace_id,
                    max_tokens=max(64, min(int(request.max_tokens), int(plan.max_total_response_tokens))),
                    temperature=float(request.temperature),
                    top_p=float(request.top_p),
                    cycle_index=0,
                    metadata={"strategy": "single_pass"},
                )
            )
        return self._invoke_engine(
            prompt=self._build_single_pass_prompt(request=request),
            mode=request.mode,
            trace_id=trace_id,
            response_language=response_language,
            max_tokens=max(64, min(int(request.max_tokens), int(plan.max_total_response_tokens))),
            temperature=float(request.temperature),
            top_p=float(request.top_p),
            metadata={"strategy": "single_pass"},
        )

    def generate_cycle_chunk(
        self,
        *,
        request: OrchestrationRequest,
        plan: EmissionPlan,
        state: SecondaryProcessMemoryState,
        step_label: str,
        cycle_index: int,
        trace_id: str,
        max_tokens: int,
    ) -> EngineResponse:
        cycle_prompt = self._build_cycle_prompt(
            request=request,
            plan=plan,
            state=state,
            step_label=step_label,
            cycle_index=cycle_index,
        )
        response_language = detect_user_language(request.prompt_original)
        if request.cycle_generator is not None:
            return request.cycle_generator(
                GenerationRequest(
                    prompt=cycle_prompt,
                    mode=request.mode,
                    response_mode="multi_pass",
                    trace_id=trace_id,
                    max_tokens=max_tokens,
                    temperature=float(request.temperature),
                    top_p=float(request.top_p),
                    cycle_index=cycle_index,
                    metadata={"strategy": "cycle_generation", "step_label": step_label},
                )
            )
        return self._invoke_engine(
            prompt=cycle_prompt,
            mode=request.mode,
            trace_id=trace_id,
            response_language=response_language,
            max_tokens=max_tokens,
            temperature=float(request.temperature),
            top_p=float(request.top_p),
            metadata={
                "strategy": "cycle_generation",
                "cycle_index": cycle_index,
                "step_label": step_label,
            },
        )

    def completion_tokens(self, response: EngineResponse) -> int:
        return _extract_completion_tokens(response)

    def _build_single_pass_prompt(self, *, request: OrchestrationRequest) -> str:
        context_payload = self._context_excerpt(request.context_payload, max_chars=3600)
        language_tag = detect_user_language(request.prompt_original)
        language_label = describe_language(language_tag)
        return (
            f"Modo ativo: {request.mode}\n"
            f"Idioma obrigatorio da resposta: {language_label} ({language_tag})\n"
            f"Objetivo: {_truncate(request.objective_current, max_chars=500)}\n"
            f"Prompt original: {_truncate(request.prompt_original, max_chars=1800)}\n"
            f"Contexto principal filtrado:\n{context_payload}\n\n"
            "Instrucoes:\n"
            "- Gere uma unica resposta final coesa.\n"
            "- Nao reinicie o raciocinio no meio da resposta.\n"
            "- Nao inclua metacomentarios sobre processo interno.\n"
        )

    def _build_cycle_prompt(
        self,
        *,
        request: OrchestrationRequest,
        plan: EmissionPlan,
        state: SecondaryProcessMemoryState,
        step_label: str,
        cycle_index: int,
    ) -> str:
        if state.phase0_call_count > 1:
            phase0_prompt = self._build_phase0_cycle_prompt(
                request=request,
                plan=plan,
                state=state,
                step_label=step_label,
                cycle_index=cycle_index,
            )
            if phase0_prompt:
                return phase0_prompt

        continuity_max_tokens = resolve_continuity_summary_max_tokens()
        context_payload = self._context_excerpt(request.context_payload, max_chars=2600)
        language_tag = detect_user_language(request.prompt_original)
        language_label = describe_language(language_tag)
        recent_summaries = state.chunk_summaries[-3:]
        blocked_repetitions = [item for item in state.forbidden_repetitions[-5:] if item]
        pending_steps = state.pending_steps[:4]
        completed_steps = state.completed_steps[:4]
        continuity_bridge = _truncate(state.continuity_bridge, max_chars=max(80, continuity_max_tokens * 4))

        return (
            f"Modo: {request.mode}\n"
            f"Idioma obrigatorio da resposta: {language_label} ({language_tag})\n"
            f"Ciclo: {cycle_index}/{plan.max_cycles}\n"
            f"Objetivo principal: {_truncate(request.objective_current, max_chars=450)}\n"
            f"Subobjetivo atual: {_truncate(step_label, max_chars=300)}\n"
            f"Prompt original: {_truncate(request.prompt_original, max_chars=1400)}\n"
            f"Contexto principal filtrado:\n{context_payload}\n\n"
            f"Passos concluidos: {completed_steps}\n"
            f"Passos pendentes: {pending_steps}\n"
            f"Resumos operacionais recentes: {recent_summaries}\n"
            f"Ponte de continuidade: {continuity_bridge}\n"
            f"Terminologia travada: {state.terminology_locked[:8]}\n"
            f"Restricoes ativas: {state.constraints_active[:8]}\n"
            f"Repeticoes proibidas: {blocked_repetitions}\n\n"
            "Instrucoes anti-redundancia obrigatorias:\n"
            "- Gere somente o proximo bloco, sem reiniciar a resposta.\n"
            "- Se tema ja foi coberto, aprofunde ou avance; nao repita.\n"
            "- Mantenha terminologia e decisoes ja registradas.\n"
            "- Preserve tom consistente e transicao com o bloco anterior.\n"
            "- Nao devolva lista de passos internos.\n"
        )

    def _build_phase0_cycle_prompt(
        self,
        *,
        request: OrchestrationRequest,
        plan: EmissionPlan,
        state: SecondaryProcessMemoryState,
        step_label: str,
        cycle_index: int,
    ) -> str:
        if cycle_index > max(1, int(state.phase0_call_count)):
            return ""

        language_tag = detect_user_language(request.prompt_original)
        language_label = describe_language(language_tag)
        context_payload = self._context_excerpt(request.context_payload, max_chars=1800)
        connector_catalog = ", ".join(OPEN_SYNTAX_CONNECTORS)
        segment_goal = _truncate(state.segment_goal or request.objective_current, max_chars=260)
        target_style = _truncate(state.target_style or request.tone_hint or "analitico continuo", max_chars=200)
        connector = state.phase0_open_connector or plan.phase0_open_connector or OPEN_SYNTAX_CONNECTORS[0]
        per_call_budget = max(96, int(plan.target_chunk_tokens))
        first_chunk_budget = max(96, min(int(plan.phase0_first_chunk_max_tokens or per_call_budget), per_call_budget))

        if cycle_index == 1:
            return (
                f"Modo: {request.mode}\n"
                f"Idioma obrigatorio da resposta: {language_label} ({language_tag})\n"
                f"FASE 0 segmentacao controlada - chamada {cycle_index}/{state.phase0_call_count}\n"
                f"Segment goal: {segment_goal}\n"
                f"Target style: {target_style}\n"
                f"Subobjetivo atual: {_truncate(step_label, max_chars=180)}\n"
                f"Token budget aproximado desta chamada: 120-180 (max {first_chunk_budget})\n"
                f"Contexto principal filtrado:\n{context_payload}\n\n"
                "Instrucoes obrigatorias da chamada 1:\n"
                "- Gere o nucleo do paragrafo com progressao analitica.\n"
                "- Introduza o eixo argumentativo sem concluir totalmente a ideia.\n"
                "- Nao use listas ou bullets.\n"
                f"- Termine obrigatoriamente com abertura sintatica. Preferencia: \"{connector}\".\n"
                f"- Expressoes validas de abertura: {connector_catalog}.\n"
                "- Nunca termine com frase totalmente fechada.\n"
            )

        first_chunk_excerpt = _truncate(state.first_chunk or (state.partial_chunks[-1] if state.partial_chunks else ""), max_chars=700)
        continuation_anchor = _truncate(state.continuation_anchor or connector, max_chars=220)
        join_rule = _truncate(state.join_rule or "segunda chamada nao reinicia sujeito principal", max_chars=220)

        if cycle_index == 2:
            return (
                f"Modo: {request.mode}\n"
                f"Idioma obrigatorio da resposta: {language_label} ({language_tag})\n"
                f"FASE 0 segmentacao controlada - chamada {cycle_index}/{state.phase0_call_count}\n"
                f"Segment goal: {segment_goal}\n"
                f"Target style: {target_style}\n"
                f"Join rule: {join_rule}\n"
                f"Ancora de continuidade: {continuation_anchor}\n"
                f"Trecho final da chamada 1:\n{first_chunk_excerpt}\n"
                f"Token budget aproximado desta chamada: 120-180 (max {per_call_budget})\n"
                f"Contexto principal filtrado:\n{context_payload}\n\n"
                "Instrucoes obrigatorias da chamada 2:\n"
                "- Continue exatamente a estrutura aberta na chamada 1.\n"
                "- Nao reinicie sujeito principal, nao abra um novo texto.\n"
                "- Feche naturalmente a ideia como unidade unica.\n"
                "- Nao use listas ou bullets.\n"
            )

        return (
            f"Modo: {request.mode}\n"
            f"Idioma obrigatorio da resposta: {language_label} ({language_tag})\n"
            f"FASE 0 segmentacao controlada - chamada {cycle_index}/{state.phase0_call_count}\n"
            f"Segment goal: {segment_goal}\n"
            f"Target style: {target_style}\n"
            f"Join rule: {_truncate(state.join_rule, max_chars=220)}\n"
            f"Ancora de continuidade: {_truncate(state.continuation_anchor, max_chars=220)}\n"
            f"Resumo dos blocos anteriores: {state.chunk_summaries[-2:]}\n"
            f"Contexto principal filtrado:\n{context_payload}\n\n"
            "Instrucoes obrigatorias da chamada 3:\n"
            "- Continue sem reiniciar o sujeito principal.\n"
            "- Consolidar e concluir com fechamento previsivel e coeso.\n"
            "- Nao introduza novo eixo estrutural.\n"
        )

    def _context_excerpt(self, payload: Dict[str, Any], *, max_chars: int) -> str:
        try:
            rendered = json.dumps(payload, ensure_ascii=False, default=str)
        except (TypeError, ValueError):
            rendered = str(payload)
        return _truncate(_normalize(rendered), max_chars=max_chars)

    def _invoke_engine(
        self,
        *,
        prompt: str,
        mode: str,
        trace_id: str,
        response_language: str,
        max_tokens: int,
        temperature: float,
        top_p: float,
        metadata: Dict[str, Any],
    ) -> EngineResponse:
        language_label = describe_language(response_language)
        system_prompt = (
            "Voce eh um gerador de resposta orquestrada em multiplos ciclos. "
            "Sempre entregue apenas texto final do bloco solicitado. "
            f"Idioma obrigatorio da resposta: {language_label} ({response_language}). "
            "Nao troque de idioma sem pedido explicito."
        )
        if mode == "write":
            system_prompt = (
                "Voce escreve em continuidade de manuscrito. "
                "Entregue apenas o proximo bloco textual, sem reiniciar secoes ja cobertas. "
                f"Idioma obrigatorio da resposta: {language_label} ({response_language}). "
                "Nao troque de idioma sem pedido explicito."
            )
        if _should_use_system_role():
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ]
        else:
            messages = [{"role": "user", "content": f"{system_prompt}\n\n{prompt}".strip()}]
        request = self.llm_adapter.engine_client.build_request(
            messages=messages,
            max_tokens=max(64, int(max_tokens)),
            temperature=max(0.0, min(float(temperature), 1.0)),
            top_p=max(0.1, min(float(top_p), 1.0)),
            trace_id=trace_id,
            metadata={"anm_orchestration": dict(metadata)},
        )
        raw = self.llm_adapter.engine_client.invoke(
            self.llm_adapter.engine_client.engine_request_to_payload(request),
            trace_id=trace_id,
        )
        return self.llm_adapter.response_parser.parse(raw, trace_id=trace_id)
