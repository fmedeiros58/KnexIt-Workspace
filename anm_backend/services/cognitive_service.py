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
from typing import Any, Dict
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


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


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
    if word_count <= 6 and not has_complex_signal:
        return "direct"
    if _is_short_prompt(normalized):
        return "short"
    return "medium"


def _resolve_generation_profile(prompt: str) -> Dict[str, Any]:
    hard_cap_raw = os.getenv("ANM_CHAT_MAX_TOKENS", "512")
    try:
        hard_cap = max(64, int(hard_cap_raw))
    except ValueError:
        hard_cap = 128

    complexity = _classify_prompt_complexity(prompt)
    if complexity == "micro":
        return {
            "max_tokens": min(hard_cap, 40),
            "temperature": 0.08,
            "top_p": 0.72,
            "style_hint": "Interacao social minima: responda em 1 frase curtissima (ate 12 palavras) e finalize.",
            "context_limit": 4,
        }
    if complexity == "strict":
        return {
            "max_tokens": min(hard_cap, 56),
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
            "max_tokens": min(hard_cap, 120),
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
            "max_tokens": min(hard_cap, 96),
            "temperature": 0.1,
            "top_p": 0.72,
            "style_hint": "Resposta objetiva: va direto ao ponto em no maximo 2 frases curtas, sem preambulo.",
            "context_limit": 5,
        }
    if complexity == "short":
        return {
            "max_tokens": min(hard_cap, 180),
            "temperature": 0.16,
            "top_p": 0.82,
            "style_hint": "Resposta curta e clara em ate 3 frases, sem repeticao.",
            "context_limit": 6,
        }
    if complexity == "medium":
        return {
            "max_tokens": min(hard_cap, 320),
            "temperature": 0.24,
            "top_p": 0.88,
            "style_hint": "Resposta equilibrada em 1 a 3 paragrafos curtos, com exemplos quando util.",
            "context_limit": 8,
        }
    return {
        "max_tokens": min(hard_cap, 480),
        "temperature": 0.24,
        "top_p": 0.84,
        "style_hint": "Resposta estruturada e objetiva com foco no pedido, sem prolixidade.",
        "context_limit": 8,
    }


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
        profile = _resolve_generation_profile(msg)

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
        response = self.llm_adapter.infer(
            user_input=msg,
            context=context,
            hypotheses=[collapsed],
            readiness_state=readiness.readiness_state.value,
            max_tokens=int(profile["max_tokens"]),
            temperature=float(profile["temperature"]),
            top_p=float(profile["top_p"]),
            style_hint=str(profile["style_hint"]),
            trace_id=trace_id,
        )
        answer = response.text.strip()
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
            "engine": {"model": response.model, "usage": response.usage},
        }
