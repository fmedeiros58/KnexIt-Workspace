"""
FILE: services/cognitive_service.py
RESPONSIBILITY: Execute end-to-end cognitive turn outside API layer.
FLOW ROLE: Orchestrates memory -> readiness -> resonance -> collapse -> engine -> reinjection.
READS: Runtime components from main bootstrap.
RAM WRITES: Mutates memory, cortex, hypotheses and pathway adaptation state.
PERSISTS: Indirectly through memory persistence bridge/checkpoint.
PRIMARY RISK: Service drift can desynchronize API and cognitive runtime behavior.
"""

from __future__ import annotations

import os
import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Dict, List
from uuid import uuid4

from anm_backend.adapters.llm_adapter import LLMAdapter
from anm_backend.anm.plasticity_readiness import PlasticityReadiness
from anm_backend.audit import audit_log
from anm_backend.memory.memory_manager import MemoryManager
from anm_backend.memory.regulatory_state import RegulatoryState
from anm_backend.orchestrator.collapse_engine import CollapseEngine
from anm_backend.orchestrator.contextual_plasticity_gate import ContextualPlasticityGate
from anm_backend.orchestrator.hypothesis_pool import Hypothesis, HypothesisPool
from anm_backend.orchestrator.myelination_engine import MyelinationEngine
from anm_backend.orchestrator.pathway_graph import PathwayGraph
from anm_backend.orchestrator.resonance_engine import ResonanceEngine
from anm_backend.services.response_orchestration import (
    OrchestrationRequest,
    ResponseOrchestrator,
    is_secondary_process_memory_enabled,
)
from anm_backend.utils import detect_user_language


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def _env_int(name: str, *, default: int, low: int, high: int) -> int:
    raw = str(os.getenv(name, str(default))).strip()
    try:
        parsed = int(raw)
    except ValueError:
        parsed = default
    return max(low, min(high, parsed))


def _normalize_prompt(prompt: str) -> str:
    lowered = prompt.strip().lower()
    if not lowered:
        return ""
    decomposed = unicodedata.normalize("NFKD", lowered)
    no_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", no_accents).strip()


def _is_short_prompt(prompt: str) -> bool:
    normalized = prompt.strip()
    if not normalized:
        return True
    words = [part for part in normalized.split() if part]
    return len(normalized) <= 90 and len(words) <= 16


def _is_micro_social_prompt(prompt: str) -> bool:
    normalized = prompt.strip()
    if not normalized:
        return False

    canonical = _normalize_prompt(normalized)
    compact = re.sub(r"\s+", " ", re.sub(r"[!?.,;:\"]", " ", canonical)).strip()
    words = [part for part in compact.split(" ") if part]
    if len(words) > 8 or len(normalized) > 60:
        return False

    patterns = [
        r"^(oi|ola|e ai|eae|opa|hey|hello)$",
        r"^(bom dia|boa tarde|boa noite)$",
        r"^(blz|beleza|tudo bem|td bem|como vai)$",
        r"^(nada por agora|nada agora|de boa|tranquilo|ok|okay|ok obrigado|obrigado|obg|valeu)$",
        r"^(ate logo|ate mais|tchau|falou|ate breve)$",
    ]
    return any(re.search(pattern, compact) for pattern in patterns)


def _is_strict_directive_prompt(prompt: str) -> bool:
    normalized = prompt.strip()
    if not normalized:
        return False

    canonical = _normalize_prompt(normalized)
    words = [part for part in normalized.split() if part]
    word_count = len(words)

    strict_patterns = [
        r"\b(responda|retorne)\b.{0,40}\b(apenas|somente)\b",
        r"\b(apenas|somente)\s+(o\s+)?(resultado|resposta)\b",
        r"\bresponda\s+apenas\s+com\b",
        r"\bso\b.{0,12}\b(resultado|resposta)\b",
    ]
    if any(re.search(pattern, canonical, re.IGNORECASE) for pattern in strict_patterns):
        return True

    if re.search(r"\b(traduz|traduza|traducao|translation)\b", canonical) and word_count <= 20:
        return True

    if re.search(r"\b(sinonimo|sinonimos|antonimo|antonimos)\b", canonical) and word_count <= 16:
        return True

    if re.search(r"\bquanto\b.{0,20}[0-9]+\s*[x\*\+\-\/]\s*[0-9]+", canonical):
        return True

    if re.search(r"\bqual\b.{0,20}\bcapital\b", canonical) and word_count <= 14:
        return True

    return False


def _is_structured_short_request(prompt: str) -> bool:
    canonical = _normalize_prompt(prompt)
    if not canonical:
        return False
    words = [part for part in canonical.split() if part]
    word_count = len(words)

    if re.search(r"\b[1-5]\s*(topicos|itens|passos|bullets?)\b", canonical):
        return True
    if canonical.startswith("passo a passo") and word_count <= 18:
        return True
    return False


def _is_brief_depth_request(prompt: str) -> bool:
    normalized = prompt.strip()
    if not normalized:
        return False

    canonical = _normalize_prompt(normalized)
    words = [part for part in canonical.split() if part]
    if len(words) > 16:
        return False

    if re.search(
        r"\b(capital|traduz|traduza|traducao|sinonimo|sinonimos|antonimo|antonimos|resultado|quanto)\b",
        canonical,
        re.IGNORECASE,
    ):
        return False
    if re.search(r"\b(o que significa|significa|defina|definicao)\b", canonical, re.IGNORECASE):
        return False

    depth_patterns = [
        r"\b(o que e|o que sao|como|por que|porque|quais?|qual a diferenca|explique|detalhe|analise|compare)\b",
        r"\b(consequenc|impact|riscos?|efeitos?|causas?|sintomas?|diagnostico|tratamento|prevenc|complicac)\b",
        r"\b(vantagens?|desvantagens?|trade[- ]?offs?)\b",
    ]
    return any(re.search(pattern, canonical, re.IGNORECASE) for pattern in depth_patterns)


def _classify_prompt_complexity(prompt: str) -> str:
    normalized = prompt.strip()
    if not normalized:
        return "short"
    if _is_micro_social_prompt(normalized):
        return "micro"
    if _is_strict_directive_prompt(normalized):
        return "strict"
    if _is_structured_short_request(normalized):
        return "structured"

    canonical = _normalize_prompt(normalized)
    words = [part for part in normalized.split() if part]
    word_count = len(words)
    char_count = len(normalized)

    direct_patterns = [
        r"\b(sinonimo|sinonimos|antonimo|antonimos)\b",
        r"\b(traduz|traduza|traducao|translation)\b",
        r"\b(defina|definicao|o que significa|significa)\b",
        r"\b(corrija|correcao|ortografia|gramatica)\b",
        r"\b(responda em uma frase|responda curto|resuma em uma frase|bem curto)\b",
    ]
    if any(re.search(pattern, canonical, re.IGNORECASE) for pattern in direct_patterns) and word_count <= 24:
        return "direct"
    if _is_brief_depth_request(normalized):
        return "medium"

    complex_signals = [
        "explique em detalhes",
        "detalhe",
        "aprofunde",
        "analise",
        "compare",
        "passo a passo",
        "arquitetura",
        "estrategia",
        "plano",
        "trade-off",
        "vantagens e desvantagens",
        "como funciona",
        "por que",
        "porque",
    ]
    has_complex_signal = any(signal in canonical for signal in complex_signals)
    if has_complex_signal or word_count >= 45 or char_count >= 260:
        return "complex"
    if word_count <= 4 and not has_complex_signal:
        if re.search(
            r"\b(o que e|como|por que|porque|quais?|impact|consequenc|riscos?|causas?|sintomas?|tratamento|prevenc)\b",
            canonical,
            re.IGNORECASE,
        ):
            return "medium"
        return "short"
    if _is_short_prompt(normalized):
        return "short"
    return "medium"


def _resolve_generation_profile(prompt: str) -> Dict[str, Any]:
    hard_cap_raw = os.getenv("ANM_CHAT_MAX_TOKENS", "4096")
    try:
        hard_cap = max(64, int(hard_cap_raw))
    except ValueError:
        hard_cap = 128

    complexity = _classify_prompt_complexity(prompt)
    if complexity == "micro":
        return {
            "complexity": complexity,
            "max_tokens": min(hard_cap, 40),
            "temperature": 0.08,
            "top_p": 0.72,
            "style_hint": "Interacao social minima: responda em 1 frase curtissima (ate 12 palavras) e finalize.",
            "context_limit": 4,
        }
    if complexity == "strict":
        return {
            "complexity": complexity,
            "max_tokens": min(hard_cap, 192),
            "temperature": 0.0,
            "top_p": 0.55,
            "style_hint": (
                "Modo estrito: entregue somente a resposta final. "
                "Nao use preambulo, saudacao, explicacao, markdown ou passos."
            ),
            "context_limit": 3,
        }
    if complexity == "structured":
        return {
            "complexity": complexity,
            "max_tokens": min(hard_cap, 384),
            "temperature": 0.08,
            "top_p": 0.72,
            "style_hint": (
                "Entregue resposta estruturada e curta. "
                "Use no maximo 4 itens curtos, sem introducao longa."
            ),
            "context_limit": 4,
        }
    if complexity == "direct":
        return {
            "complexity": complexity,
            "max_tokens": min(hard_cap, 320),
            "temperature": 0.1,
            "top_p": 0.72,
            "style_hint": "Resposta objetiva: va direto ao ponto em 1 paragrafo curto (2 a 4 frases), sem preambulo.",
            "context_limit": 5,
        }
    if complexity == "short":
        return {
            "complexity": complexity,
            "max_tokens": min(hard_cap, 1024),
            "temperature": 0.16,
            "top_p": 0.82,
            "style_hint": "Resposta clara e completa em 1 ou 2 paragrafos curtos, com foco no pedido e sem repeticao.",
            "context_limit": 6,
        }
    if complexity == "medium":
        return {
            "complexity": complexity,
            "max_tokens": min(hard_cap, 2048),
            "temperature": 0.24,
            "top_p": 0.88,
            "style_hint": "Resposta aprofundada em 3 a 6 paragrafos curtos, com progressao logica e exemplos quando util.",
            "context_limit": 8,
        }
    return {
        "complexity": complexity,
        "max_tokens": hard_cap,
        "temperature": 0.24,
        "top_p": 0.84,
        "style_hint": "Resposta estruturada e aprofundada em 4 a 7 paragrafos, com sintese final clara.",
        "context_limit": 8,
    }


def _resolve_chat_multi_pass_directives(*, complexity: str, prompt: str = "") -> Dict[str, Any]:
    if complexity in {"micro", "strict", "direct"}:
        return {
            "prefer_multi_pass": False,
            "min_cycles": 1,
            "max_cycles": 1,
            "target_chunk_tokens": None,
            "max_total_tokens": None,
        }

    base_cycles = _env_int("ANM_CHAT_SECONDARY_BASE_CYCLES", default=6, low=3, high=8)
    base_adjust = base_cycles - 6

    normalized_prompt = re.sub(r"\s+", " ", str(prompt or "").strip())
    canonical_prompt = _normalize_prompt(normalized_prompt)
    prompt_words = [token for token in canonical_prompt.split(" ") if token]
    word_count = len(prompt_words)
    char_count = len(normalized_prompt)
    detail_score = 0
    if word_count >= 16:
        detail_score += 1
    if word_count >= 32:
        detail_score += 1
    if char_count >= 180:
        detail_score += 1
    if char_count >= 320:
        detail_score += 1
    if normalized_prompt.count("?") >= 2:
        detail_score += 1
    if re.search(
        r"\b(analise|detalhe|explique|compare|passo a passo|trade[- ]?off|causas?|efeitos?|riscos?|tratamento|prevenc|consequenc)\b",
        canonical_prompt,
        re.IGNORECASE,
    ):
        detail_score += 1

    if complexity == "structured":
        min_cycles = 2 + min(2, detail_score)
        low, high = 2, 4
    elif complexity == "short":
        min_cycles = 3 + min(2, detail_score)
        low, high = 3, 5
    elif complexity == "medium":
        min_cycles = 4 + min(3, detail_score)
        low, high = 4, 7
    else:
        min_cycles = 5 + min(3, detail_score)
        low, high = 5, 8

    min_cycles = max(low, min(high, min_cycles + base_adjust))

    if complexity in {"medium", "complex"}:
        max_cycles = min(8, min_cycles + (1 if detail_score >= 2 else 0))
    else:
        max_cycles = min(8, min_cycles + (1 if detail_score >= 3 else 0))
    max_cycles = max(min_cycles, max_cycles)

    target_chunk_base = _env_int("ANM_CHAT_SECONDARY_TARGET_CHUNK_TOKENS", default=360, low=120, high=1200)
    if complexity == "structured":
        target_chunk_tokens = max(160, min(target_chunk_base, 320 + (detail_score * 20)))
    elif complexity == "short":
        target_chunk_tokens = max(220, min(target_chunk_base, 380 + (detail_score * 24)))
    elif complexity == "medium":
        target_chunk_tokens = max(300, min(target_chunk_base, 520 + (detail_score * 28)))
    else:
        target_chunk_tokens = max(360, min(target_chunk_base, 720 + (detail_score * 32)))

    max_total_tokens = _env_int("ANM_CHAT_SECONDARY_MAX_TOTAL_TOKENS", default=8192, low=512, high=32768)
    return {
        "prefer_multi_pass": True,
        "min_cycles": min_cycles,
        "max_cycles": max_cycles,
        "target_chunk_tokens": target_chunk_tokens,
        "max_total_tokens": max_total_tokens,
    }


def _build_chat_planner_hints(*, prompt: str, collapsed_summary: str, cycles: int) -> List[str]:
    normalized_prompt = re.sub(r"\s+", " ", str(prompt or "").strip())
    prompt_excerpt = normalized_prompt[:160] + ("..." if len(normalized_prompt) > 160 else "")
    summary_excerpt = re.sub(r"\s+", " ", str(collapsed_summary or "").strip())
    summary_excerpt = summary_excerpt[:180] + ("..." if len(summary_excerpt) > 180 else "")

    hints = [
        f"contexto e definicoes principais do pedido: {prompt_excerpt}",
        "fundamentos, mecanismos e causas centrais do tema",
        "desdobramentos praticos e implicacoes relevantes",
        "riscos, limites, excecoes e contrapontos",
        "orientacoes aplicaveis e criterios de decisao",
        "sintese integrada com fechamento objetivo",
    ]
    if summary_excerpt:
        hints.insert(1, f"hipotese guia para continuidade: {summary_excerpt}")

    while len(hints) < max(1, int(cycles)):
        hints.append(f"aprofundamento adicional {len(hints) + 1}")
    target = max(1, int(cycles))
    selected = hints[:target]
    if target >= 3 and not any("sintese" in item.lower() for item in selected):
        selected[-1] = "sintese integrada com fechamento objetivo"
    return selected


@dataclass
class CognitiveService:
    """
    Objective:
        Provide one executable cognitive turn pipeline.
    Responsibilities:
        Run readiness modulation before structural updates and consolidation.
    Limits:
        No HTTP concerns.
    Mutates:
        Runtime cognitive state.
    Must not:
        Hide critical flow side effects.
    """

    memory_manager: MemoryManager
    resonance_engine: ResonanceEngine
    hypothesis_pool: HypothesisPool
    collapse_engine: CollapseEngine
    llm_adapter: LLMAdapter
    plasticity_readiness: PlasticityReadiness
    regulatory_state: RegulatoryState
    contextual_gate: ContextualPlasticityGate
    graph: PathwayGraph
    myelination_engine: MyelinationEngine
    response_orchestrator: ResponseOrchestrator | None = None

    def run_chat_turn(self, message: str) -> Dict[str, Any]:
        """
        Purpose:
            Execute one complete chat-driven cognitive cycle.
        Parameters:
            message: User input text.
        Returns:
            Dict[str, Any]: Structured response payload.
        Side Effects:
            Mutates live RAM cognition and emits audit logs.
        RAM Impact:
            End-to-end mutation in memory, hypotheses and pathway graph.
        Persistence Impact:
            None directly.
        Expected Failures:
            RuntimeError from engine invocation path.
        """

        trace_id = f"trace-{uuid4()}"
        msg = message.strip()
        if not msg:
            raise ValueError("message is required")
        response_language = detect_user_language(msg)
        profile = _resolve_generation_profile(msg)
        prompt_complexity = str(profile.get("complexity", "medium"))

        self.hypothesis_pool.clear()
        message_quality = _clamp(min(1.0, 0.2 + (len(msg) / 240.0)))
        self.memory_manager.ingest_observation(
            module_id="chat",
            nodule_id="language_nodule",
            content={"role": "user", "text": msg},
            salience=0.78,
            objective_fit=0.88,
            stimulus_quality=message_quality,
            support_density=0.62,
            trace_id=trace_id,
        )

        metrics = self.regulatory_state.metrics(stimulus_quality=message_quality)
        readiness = self.plasticity_readiness.compute(metrics)
        self.regulatory_state.register_readiness(
            readiness.readiness_score,
            readiness.readiness_state,
            dominant_factors=readiness.dominant_factors,
        )
        gate_decision = self.contextual_gate.apply(readiness, self.regulatory_state)

        hypotheses = self.resonance_engine.run(
            seed_nodule_id="language_nodule",
            seed_strength=0.9,
            cortex=self.memory_manager.cortex,
            hypothesis_pool=self.hypothesis_pool,
            gate_decision=gate_decision,
            trace_id=trace_id,
            stimulus_metrics=metrics,
        )
        candidates = hypotheses or self.hypothesis_pool.collapse_candidates(k=3)
        collapsed = self.collapse_engine.collapse(candidates, trace_id=trace_id) if candidates else Hypothesis(
            hypothesis_id="fallback",
            content="fallback hypothesis",
            score=0.2,
            probability=0.5,
            cost=1.0,
            objective_fit=0.5,
            origin_nodule="language_nodule",
            stimulus_coherence=metrics["stimulus_coherence"],
        )

        self.memory_manager.register_hypothesis_state(
            hypothesis_id=collapsed.hypothesis_id,
            summary=collapsed.content,
            score=collapsed.score,
            probability=collapsed.probability,
            cost=collapsed.cost,
            objective_fit=collapsed.objective_fit,
            stimulus_coherence=collapsed.stimulus_coherence,
            metadata={"origin_nodule": collapsed.origin_nodule},
        )

        context = self.memory_manager.assemble_prompt_context(limit=int(profile["context_limit"]))
        cycle_metadata = dict(context.get("cycle_metadata", {}))
        include_followup_prompt = bool(cycle_metadata.get("followup_prompt_next", False))
        orchestration_enabled = bool(self.response_orchestrator) and is_secondary_process_memory_enabled("chat")
        orchestration_directives = _resolve_chat_multi_pass_directives(
            complexity=prompt_complexity,
            prompt=msg,
        )
        planner_hints = (
            _build_chat_planner_hints(
                prompt=msg,
                collapsed_summary=collapsed.content,
                cycles=int(orchestration_directives["max_cycles"]),
            )
            if orchestration_directives["prefer_multi_pass"]
            else [collapsed.content]
        )
        if orchestration_enabled and self.response_orchestrator:
            def _single_pass(gen_request):
                return self.llm_adapter.infer(
                    user_input=msg,
                    context=context,
                    hypotheses=[collapsed],
                    readiness_state=readiness.readiness_state.value,
                    max_tokens=int(gen_request.max_tokens),
                    temperature=float(gen_request.temperature),
                    top_p=float(gen_request.top_p),
                    style_hint=str(profile["style_hint"]),
                    response_language=response_language,
                    include_followup_prompt=include_followup_prompt,
                    trace_id=gen_request.trace_id,
                )

            def _cycle_pass(gen_request):
                return self.llm_adapter.infer(
                    user_input=str(gen_request.prompt),
                    context=context,
                    hypotheses=[collapsed],
                    readiness_state=readiness.readiness_state.value,
                    max_tokens=int(gen_request.max_tokens),
                    temperature=max(0.05, min(float(gen_request.temperature), 0.9)),
                    top_p=float(gen_request.top_p),
                    style_hint=(
                        f"{profile['style_hint']} "
                        "Continue a resposta sem reiniciar o raciocinio; avance com continuidade e sem repeticao. "
                        "Neste ciclo, entregue 1 paragrafo substantivo (entre 4 e 7 frases), sem listas ou bullets."
                    ),
                    response_language=response_language,
                    include_followup_prompt=False,
                    trace_id=gen_request.trace_id,
                )

            orchestration_result = self.response_orchestrator.orchestrate(
                request=OrchestrationRequest(
                    request_id=trace_id,
                    mode="chat",
                    user_id="chat-session",
                    thread_id="chat-thread",
                    prompt_original=msg,
                    objective_current=msg,
                    context_payload={
                        "prompt_context": context,
                        "collapsed_hypothesis": {
                            "id": collapsed.hypothesis_id,
                            "summary": collapsed.content,
                            "score": collapsed.score,
                            "origin_nodule": collapsed.origin_nodule,
                        },
                        "readiness_state": readiness.readiness_state.value,
                    },
                    max_tokens=int(profile["max_tokens"]),
                    temperature=float(profile["temperature"]),
                    top_p=float(profile["top_p"]),
                    tone_hint=str(profile["style_hint"]),
                    planner_hints=planner_hints,
                    prefer_multi_pass=bool(orchestration_directives["prefer_multi_pass"]),
                    max_cycles_override=int(orchestration_directives["max_cycles"]),
                    min_cycles_override=int(orchestration_directives["min_cycles"]),
                    target_chunk_tokens_override=(
                        int(orchestration_directives["target_chunk_tokens"])
                        if orchestration_directives["target_chunk_tokens"] is not None
                        else None
                    ),
                    max_total_response_tokens_override=(
                        int(orchestration_directives["max_total_tokens"])
                        if orchestration_directives["max_total_tokens"] is not None
                        else None
                    ),
                    constraints=[f"readiness_state:{readiness.readiness_state.value}"],
                    single_pass_generator=_single_pass,
                    cycle_generator=_cycle_pass,
                    metadata={
                        "flow": "chat_turn",
                        "prompt_complexity": prompt_complexity,
                        "adaptive_multi_pass": bool(orchestration_directives["prefer_multi_pass"]),
                        "response_language": response_language,
                    },
                )
            )
            answer = orchestration_result.response_text.strip()
            response_model = orchestration_result.models_used[-1] if orchestration_result.models_used else self.llm_adapter.engine_client.model_name
            response_usage = dict(orchestration_result.usage)
            orchestration_payload = {
                "enabled": True,
                "response_mode": orchestration_result.response_mode,
                "cycle_count": orchestration_result.cycle_count,
                "stop_reason": orchestration_result.stop_reason,
                "fallback_used": orchestration_result.fallback_used,
                "session_id": orchestration_result.session_id,
                "min_cycles_required": int(
                    dict(orchestration_result.telemetry.get("plan", {})).get("min_cycles_required", 1)
                ),
            }
        else:
            response = self.llm_adapter.infer(
                user_input=msg,
                context=context,
                hypotheses=[collapsed],
                readiness_state=readiness.readiness_state.value,
                max_tokens=int(profile["max_tokens"]),
                temperature=float(profile["temperature"]),
                top_p=float(profile["top_p"]),
                style_hint=str(profile["style_hint"]),
                response_language=response_language,
                include_followup_prompt=include_followup_prompt,
                trace_id=trace_id,
            )
            answer = response.text.strip()
            response_model = response.model
            response_usage = response.usage
            orchestration_payload = {
                "enabled": False,
                "response_mode": "single_pass_direct",
                "cycle_count": 1,
                "stop_reason": "direct_infer",
                "fallback_used": False,
                "session_id": None,
                "min_cycles_required": 1,
            }
        self.memory_manager.cortex.set_cycle_metadata_value("followup_prompt_next", True)
        assistant_item_id = self.memory_manager.ingest_observation(
            module_id="chat",
            nodule_id="language_nodule",
            content={"role": "assistant", "text": answer},
            salience=0.66,
            objective_fit=0.82,
            stimulus_quality=_clamp(collapsed.objective_fit),
            support_density=_clamp(0.55 + collapsed.stimulus_coherence * 0.2),
            trace_id=trace_id,
        )

        self.memory_manager.reinforce_item(
            item_id=assistant_item_id,
            module_id="chat",
            score_delta=0.08,
            gate_decision=gate_decision,
            trace_id=trace_id,
        )
        self.memory_manager.run_forgetting_cycle()
        if answer:
            self.myelination_engine.reinforce(self.graph, "language_nodule", "planner_nodule", reward=collapsed.score, trace_id=trace_id)
        else:
            self.myelination_engine.weaken(self.graph, "language_nodule", "planner_nodule", penalty=0.7, trace_id=trace_id)

        audit_log(
            component="services.cognitive_service",
            event="chat_turn_completed",
            payload={
                "trace_id": trace_id,
                "hypothesis_id": collapsed.hypothesis_id,
                "readiness_score": readiness.readiness_score,
                "readiness_state": readiness.readiness_state.value,
                "answer_length": len(answer),
                "max_tokens": int(profile["max_tokens"]),
                "temperature": float(profile["temperature"]),
                "top_p": float(profile["top_p"]),
                "response_language": response_language,
                "followup_prompt_included": include_followup_prompt,
                "orchestration_enabled": orchestration_payload["enabled"],
                "orchestration_response_mode": orchestration_payload["response_mode"],
                "orchestration_cycle_count": orchestration_payload["cycle_count"],
                "orchestration_min_cycles_required": orchestration_payload["min_cycles_required"],
                "orchestration_stop_reason": orchestration_payload["stop_reason"],
                "orchestration_fallback_used": orchestration_payload["fallback_used"],
            },
            trace_id=trace_id,
        )
        return {
            "trace_id": trace_id,
            "answer": answer,
            "collapsed_hypothesis": {
                "id": collapsed.hypothesis_id,
                "score": collapsed.score,
                "origin_nodule": collapsed.origin_nodule,
                "stimulus_coherence": collapsed.stimulus_coherence,
            },
            "readiness": {
                "score": readiness.readiness_score,
                "state": readiness.readiness_state.value,
                "dominant_factors": readiness.dominant_factors,
            },
            "regulatory_state": {
                "stress_load": self.regulatory_state.stress_load,
                "context_stability": self.regulatory_state.context_stability,
            },
            "engine": {
                "model": response_model,
                "usage": response_usage,
                "response_language": response_language,
                "followup_prompt_included": include_followup_prompt,
                "orchestration": orchestration_payload,
            },
        }
