"""
FILE: adapters/prompt_builder.py
RESPONSIBILITY: Compose engine prompt from live RAM context and hypotheses.
FLOW ROLE: Convert cognitive state into concise model input.
READS: Memory context and collapsed/top hypotheses.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Prompt inflation if context is not bounded.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, List

from anm_backend.orchestrator.hypothesis_pool import Hypothesis
from anm_backend.utils import describe_language, detect_user_language


@dataclass
class PromptBuilder:
    """
    Objective:
        Build compact prompt with RAM-first context priority.
    Responsibilities:
        Prioritize active context, working memory and dominant hypothesis.
    Limits:
        No engine call or response parsing.
    Mutates:
        None.
    Must not:
        Read persistence directly.
    """

    context_limit: int = 8
    hypothesis_limit: int = 3
    max_line_chars: int = 220
    max_payload_chars: int = 2200

    def _truncate(self, value: object, max_chars: int | None = None) -> str:
        text = str(value).strip()
        limit = max_chars or self.max_line_chars
        if len(text) <= limit:
            return text
        return text[: max(8, limit - 3)].rstrip() + "..."

    def _format_top_mapping(self, value: object, max_items: int = 6, numeric_sort: bool = False) -> str:
        if not isinstance(value, dict) or not value:
            return ""

        items = list(value.items())
        if numeric_sort:
            numeric_items = []
            for key, raw in items:
                try:
                    numeric_items.append((str(key), float(raw)))
                except (TypeError, ValueError):
                    continue
            numeric_items.sort(key=lambda item: item[1], reverse=True)
            picked = numeric_items[:max_items]
            return ", ".join(f"{key}:{score:.3f}" for key, score in picked)

        picked = items[:max_items]
        return ", ".join(f"{self._truncate(key, 32)}={self._truncate(raw, 48)}" for key, raw in picked)

    def build_messages(
        self,
        *,
        user_input: str,
        context: Dict[str, object],
        hypotheses: List[Hypothesis],
        readiness_state: str,
        style_hint: str = "",
        response_plan: Dict[str, Any] | None = None,
        response_language: str | None = None,
        include_followup_prompt: bool = False,
    ) -> List[Dict[str, str]]:
        """
        Purpose:
            Build OpenAI-compatible chat messages.
        Parameters:
            user_input: User text.
            context: Live context from memory manager.
            hypotheses: Active hypotheses.
            readiness_state: Current readiness state label.
            style_hint: Extra style instruction.
            response_plan: Optional response sizing guidance.
            include_followup_prompt: If true, request one follow-up question/suggestion at the end.
        Returns:
            List[Dict[str, str]]: Message list.
        Side Effects:
            None.
        RAM Impact:
            Temporary string/list allocations.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        working_items = list(context.get("working", []))[: self.context_limit]
        global_semantic = dict(context.get("global_semantic", {}))
        activation_map = dict(context.get("activation_map", {}))
        hot_index = dict(context.get("hot_index", {}))
        cycle_metadata = dict(context.get("cycle_metadata", {}))
        regulatory = dict(context.get("regulatory", {}))
        selected_hypotheses = hypotheses[: self.hypothesis_limit]
        context_signal_count = len(working_items) + len(global_semantic) + len(selected_hypotheses)
        low_ram_context = context_signal_count <= 1

        context_lines: List[str] = ["[RAM Contexto Ativo]"]
        for item in working_items:
            context_lines.append(f"- WM: {self._truncate(item)}")
        if global_semantic:
            compact_semantic = self._format_top_mapping(global_semantic, max_items=5, numeric_sort=False)
            if compact_semantic:
                context_lines.append(f"- Semantica global: {compact_semantic}")
        if hot_index:
            compact_hot = self._format_top_mapping(hot_index, max_items=6, numeric_sort=True)
            if compact_hot:
                context_lines.append(f"- Hot index: {compact_hot}")
        if activation_map:
            compact_activation = self._format_top_mapping(activation_map, max_items=6, numeric_sort=True)
            if compact_activation:
                context_lines.append(f"- Ativacoes: {compact_activation}")
        if cycle_metadata:
            cycle_id = cycle_metadata.get("cycle_id")
            if cycle_id is not None:
                context_lines.append(f"- Ciclo: {self._truncate(cycle_id, 16)}")
        if selected_hypotheses:
            dominant = selected_hypotheses[0]
            context_lines.append(
                f"- Hipotese dominante ({dominant.hypothesis_id}, score={dominant.score:.3f}, coherence={dominant.stimulus_coherence:.3f}): "
                f"{self._truncate(dominant.content, 300)}"
            )
            for hypothesis in selected_hypotheses[1:]:
                context_lines.append(
                    f"- Hipotese alternativa ({hypothesis.hypothesis_id}, score={hypothesis.score:.3f}): "
                    f"{self._truncate(hypothesis.content, 220)}"
                )
        context_lines.append(f"- Suficiencia de contexto RAM: {'baixa' if low_ram_context else 'adequada'}")
        context_lines.append(f"- Readiness atual: {readiness_state}")
        context_lines.append(f"- Estado regulatorio: {self._truncate(regulatory, 200)}")
        plan_payload = dict(response_plan or {})
        target_tokens_raw = plan_payload.get("target_tokens")
        try:
            target_tokens = max(0, int(target_tokens_raw)) if target_tokens_raw is not None else 0
        except (TypeError, ValueError):
            target_tokens = 0

        language_tag = str(response_language or "").strip() or detect_user_language(user_input)
        language_label = describe_language(language_tag)

        system = (
            "Voce opera como casca cognitiva ANM RAM-first. "
            "Responda primeiro com base no contexto ativo de RAM, hipotese dominante e estabilidade regulatoria. "
            "Se o contexto RAM estiver fraco, responda perguntas genericas usando conhecimento geral confiavel do modelo, "
            "sem bloquear a resposta com falta de contexto. "
            "Mantenha progressao logica de inicio, meio e fim; quando a resposta for curta, comprima essa ordem em poucas linhas. "
            "Responda com objetividade e sem preambulo. "
            "Se o usuario pedir resposta curta, cumpra estritamente. "
            f"Idioma obrigatorio da resposta: {language_label} ({language_tag}). "
            "Nao mude de idioma sem pedido explicito de traducao."
        )
        system = (
            f"{system} "
            "Evite respostas do tipo 'sem base suficiente no contexto' para perguntas gerais. "
            "Use ressalva breve apenas quando o usuario pedir dado especifico verificavel (numero, diretriz, data ou dosagem)."
        )
        if target_tokens > 0:
            system = (
                f"{system} "
                f"Planeje a resposta para aproximadamente {target_tokens} tokens, mantendo apenas o necessario para atender o pedido."
            )
        if include_followup_prompt:
            system = (
                f"{system} "
                "No fechamento, inclua 1 pergunta objetiva OU 1 sugestao curta para agregar mais informacao no proximo passo."
            )
        if style_hint:
            system = f"{system}\nDiretriz de estilo: {style_hint}"

        raw_context = "\n".join(context_lines)
        context_block = self._truncate(raw_context, self.max_payload_chars)
        user = "Contexto vivo:\n" + context_block + f"\n\nPergunta do usuario:\n{self._truncate(user_input, 600)}"
        use_system_role = os.getenv("ANM_ENGINE_USE_SYSTEM_ROLE", "0").strip() in {"1", "true", "TRUE", "yes", "YES"}
        if use_system_role:
            return [{"role": "system", "content": system}, {"role": "user", "content": user}]
        return [{"role": "user", "content": f"{system}\n\n{user}"}]
