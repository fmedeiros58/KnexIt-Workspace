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
from anm_backend.services.response_orchestration.types import (
    EmissionPlan,
    GenerationRequest,
    OrchestrationRequest,
    SecondaryProcessMemoryState,
)


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
        return (
            f"Modo ativo: {request.mode}\n"
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
        continuity_max_tokens = resolve_continuity_summary_max_tokens()
        context_payload = self._context_excerpt(request.context_payload, max_chars=2600)
        recent_summaries = state.chunk_summaries[-3:]
        blocked_repetitions = [item for item in state.forbidden_repetitions[-5:] if item]
        pending_steps = state.pending_steps[:4]
        completed_steps = state.completed_steps[:4]
        continuity_bridge = _truncate(state.continuity_bridge, max_chars=max(80, continuity_max_tokens * 4))

        return (
            f"Modo: {request.mode}\n"
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
        max_tokens: int,
        temperature: float,
        top_p: float,
        metadata: Dict[str, Any],
    ) -> EngineResponse:
        system_prompt = (
            "Voce eh um gerador de resposta orquestrada em multiplos ciclos. "
            "Sempre entregue apenas texto final do bloco solicitado."
        )
        if mode == "write":
            system_prompt = (
                "Voce escreve em continuidade de manuscrito. "
                "Entregue apenas o proximo bloco textual, sem reiniciar secoes ja cobertas."
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
