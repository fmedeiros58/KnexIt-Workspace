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
from typing import Dict, List

from anm_backend.orchestrator.hypothesis_pool import Hypothesis


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

    def build_messages(
        self,
        *,
        user_input: str,
        context: Dict[str, object],
        hypotheses: List[Hypothesis],
        readiness_state: str,
    ) -> List[Dict[str, str]]:
        """
        Purpose:
            Build OpenAI-compatible chat messages.
        Parameters:
            user_input: User text.
            context: Live context from memory manager.
            hypotheses: Active hypotheses.
            readiness_state: Current readiness state label.
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
        regulatory = dict(context.get("regulatory", {}))
        selected_hypotheses = hypotheses[: self.hypothesis_limit]

        context_lines: List[str] = ["[RAM Contexto Ativo]"]
        for item in working_items:
            context_lines.append(f"- WM: {item}")
        if global_semantic:
            context_lines.append(f"- Semantica global: {global_semantic}")
        if activation_map:
            context_lines.append(f"- Ativacoes: {activation_map}")
        if selected_hypotheses:
            dominant = selected_hypotheses[0]
            context_lines.append(
                f"- Hipotese dominante ({dominant.hypothesis_id}, score={dominant.score:.3f}, coherence={dominant.stimulus_coherence:.3f}): {dominant.content}"
            )
            for hypothesis in selected_hypotheses[1:]:
                context_lines.append(
                    f"- Hipotese alternativa ({hypothesis.hypothesis_id}, score={hypothesis.score:.3f}): {hypothesis.content}"
                )
        context_lines.append(f"- Readiness atual: {readiness_state}")
        context_lines.append(f"- Estado regulatorio: {regulatory}")

        system = (
            "Você opera como casca cognitiva ANM RAM-first. "
            "Responda usando primeiro contexto ativo em RAM, hipótese dominante e estabilidade regulatória."
        )
        user = "Contexto vivo:\n" + "\n".join(context_lines) + f"\n\nPergunta do usuário:\n{user_input}"
        use_system_role = os.getenv("ANM_ENGINE_USE_SYSTEM_ROLE", "0").strip() in {"1", "true", "TRUE", "yes", "YES"}
        if use_system_role:
            return [{"role": "system", "content": system}, {"role": "user", "content": user}]
        return [{"role": "user", "content": f"{system}\n\n{user}"}]
