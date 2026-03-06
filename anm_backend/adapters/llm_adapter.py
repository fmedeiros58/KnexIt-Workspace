"""
FILE: adapters/llm_adapter.py
RESPONSIBILITY: Bridge ANM cognition to existing engine invocation.
FLOW ROLE: Prompt build -> engine invoke -> response parse.
READS: User input, memory context, hypotheses and readiness state.
RAM WRITES: None directly.
PERSISTS: None.
PRIMARY RISK: Invalid context composition can degrade response quality.
"""

from __future__ import annotations

import math
import os
import re
from dataclasses import dataclass
from typing import Dict, List
from uuid import uuid4

from anm_backend.adapters.engine_client import EngineClient
from anm_backend.adapters.prompt_builder import PromptBuilder
from anm_backend.adapters.response_parser import ResponseParser
from anm_backend.contracts import EngineResponse
from anm_backend.orchestrator.hypothesis_pool import Hypothesis


@dataclass(frozen=True)
class TokenBudgetPlan:
    """
    Objective:
        Represent one deterministic token planning snapshot before invocation.
    Responsibilities:
        Keep prompt estimate, output target and limits explicit.
    Limits:
        Heuristic estimates only (not tokenizer-exact).
    Mutates:
        None.
    Must not:
        Exceed hard request limits.
    """

    prompt_tokens_estimate: int
    requested_max_tokens: int
    requested_output_tokens: int
    target_output_tokens: int
    context_window_tokens: int
    safety_margin_tokens: int

    def as_dict(self) -> Dict[str, int]:
        """
        Purpose:
            Convert plan into JSON-friendly dictionary.
        Parameters:
            None.
        Returns:
            Dict[str, int]: Token planning metadata.
        Side Effects:
            None.
        RAM Impact:
            Temporary dict allocation.
        Persistence Impact:
            Optional transport metadata only.
        Expected Failures:
            None.
        """

        return {
            "prompt_tokens_estimate": self.prompt_tokens_estimate,
            "requested_max_tokens": self.requested_max_tokens,
            "requested_output_tokens": self.requested_output_tokens,
            "target_output_tokens": self.target_output_tokens,
            "context_window_tokens": self.context_window_tokens,
            "safety_margin_tokens": self.safety_margin_tokens,
        }


@dataclass
class LLMAdapter:
    """
    Objective:
        Provide one cohesive integration surface to engine runtime.
    Responsibilities:
        Compose messages, invoke engine client and return typed response.
    Limits:
        No memory/orchestration ownership.
    Mutates:
        None.
    Must not:
        Reimplement LLM inference.
    """

    engine_client: EngineClient
    prompt_builder: PromptBuilder
    response_parser: ResponseParser

    @staticmethod
    def _clamp_int(value: int, *, low: int, high: int) -> int:
        return max(low, min(high, int(value)))

    def _resolve_context_window_tokens(self) -> int:
        raw = (
            os.getenv("ANM_ENGINE_CONTEXT_WINDOW_TOKENS")
            or os.getenv("ANM_CHAT_CONTEXT_WINDOW_TOKENS")
            or "8192"
        ).strip()
        try:
            return self._clamp_int(int(raw), low=1024, high=262_144)
        except ValueError:
            return 8192

    def _resolve_safety_margin_tokens(self) -> int:
        raw = (os.getenv("ANM_ENGINE_CONTEXT_SAFETY_MARGIN_TOKENS") or "192").strip()
        try:
            return self._clamp_int(int(raw), low=32, high=4096)
        except ValueError:
            return 192

    def _estimate_text_tokens(self, text: str) -> int:
        normalized = re.sub(r"\s+", " ", str(text or "").strip())
        if not normalized:
            return 0
        words = [part for part in normalized.split(" ") if part]
        by_chars = math.ceil(len(normalized) / 3.8)
        by_words = math.ceil(len(words) * 1.25)
        return max(1, by_chars, by_words)

    def _extract_requested_output_tokens(self, user_input: str) -> int | None:
        normalized = re.sub(r"\s+", " ", str(user_input or "").strip().lower())
        if not normalized:
            return None

        matches = list(
            re.finditer(
                r"\b(\d{1,5})\s*(tokens?|palavras?|words?|frases?|linhas?|paragrafos?)\b",
                normalized,
                re.IGNORECASE,
            )
        )
        if not matches:
            return None

        def has_explicit_limit_intent(match: re.Match[str]) -> bool:
            start, end = match.span()
            prefix = normalized[max(0, start - 72) : start]
            suffix = normalized[end : min(len(normalized), end + 40)]
            local = f"{prefix}{normalized[start:end]}{suffix}"

            # Do not cap full response when user asks for a short closing phrase only.
            if re.search(r"\b(finalize|conclua|encerre|feche)\s+com\b", prefix):
                return False
            if re.search(r"\b(sintese|resumo)\b", local) and re.search(
                r"\b(finalize|conclua|encerre|feche)\b", prefix
            ):
                return False

            if re.search(
                r"\b(no maximo|maximo|ate|limite|apenas|somente|up to|at most|maximum|max)\b",
                local,
            ):
                return True

            if re.search(
                r"\b(responda|retorne|escreva|gere|forneca|explique|resuma|descreva|liste|detalhe|"
                r"answer|respond|write|generate|explain|summarize|describe|list)\b",
                prefix,
            ) and re.search(r"\b(em|com|in|with)\s*$", prefix):
                return True

            return False

        selected = next((item for item in matches if has_explicit_limit_intent(item)), None)
        if selected is None:
            return None

        value = int(selected.group(1))
        unit = selected.group(2).lower()
        if "token" in unit:
            estimated = value
        elif "palavra" in unit or "word" in unit:
            estimated = math.ceil(value * 1.35)
        elif "frase" in unit:
            estimated = value * 32
        elif "linha" in unit:
            estimated = value * 20
        else:
            estimated = value * 120
        return self._clamp_int(estimated, low=32, high=65_536)

    def _estimate_messages_tokens(self, messages: List[Dict[str, str]]) -> int:
        total = 0
        for row in messages:
            role = str(row.get("role", ""))
            content = str(row.get("content", ""))
            total += self._estimate_text_tokens(role) + self._estimate_text_tokens(content) + 6
        return max(0, total + 16)

    def _plan_token_budget(
        self,
        *,
        user_input: str,
        messages: List[Dict[str, str]],
        requested_max_tokens: int,
    ) -> TokenBudgetPlan:
        requested_cap = self._clamp_int(int(requested_max_tokens), low=32, high=65_536)
        explicit_output_request = self._extract_requested_output_tokens(user_input)
        requested_output = requested_cap if explicit_output_request is None else min(requested_cap, explicit_output_request)
        context_window = self._resolve_context_window_tokens()
        safety_margin = self._resolve_safety_margin_tokens()
        prompt_tokens_estimate = self._estimate_messages_tokens(messages)
        available_output = context_window - prompt_tokens_estimate - safety_margin
        hard_min = min(96, requested_output)
        if available_output < 32:
            available_output = 32
        target_output = min(requested_output, available_output)
        if target_output < hard_min and available_output >= hard_min:
            target_output = hard_min
        target_output = self._clamp_int(int(target_output), low=32, high=requested_cap)

        return TokenBudgetPlan(
            prompt_tokens_estimate=prompt_tokens_estimate,
            requested_max_tokens=requested_cap,
            requested_output_tokens=requested_output,
            target_output_tokens=target_output,
            context_window_tokens=context_window,
            safety_margin_tokens=safety_margin,
        )

    def infer(
        self,
        *,
        user_input: str,
        context: Dict[str, object],
        hypotheses: List[Hypothesis],
        readiness_state: str,
        max_tokens: int = 512,
        temperature: float = 0.3,
        top_p: float = 0.9,
        style_hint: str = "",
        response_language: str | None = None,
        include_followup_prompt: bool = False,
        trace_id: str | None = None,
    ) -> EngineResponse:
        """
        Purpose:
            Execute one inference cycle against existing engine.
        Parameters:
            user_input: User message.
            context: Prompt context.
            hypotheses: Active hypotheses.
            readiness_state: Current readiness state label.
            max_tokens: Token budget.
            response_language: Optional forced output language tag.
            include_followup_prompt: If true, ask model to close with one follow-up question/suggestion.
            trace_id: Optional trace id.
        Returns:
            EngineResponse: Parsed typed engine response.
        Side Effects:
            Performs one engine network invocation.
        RAM Impact:
            Temporary request/response allocations.
        Persistence Impact:
            None.
        Expected Failures:
            RuntimeError from engine client failures.
        """

        trace = trace_id or f"trace-{uuid4()}"
        draft_messages = self.prompt_builder.build_messages(
            user_input=user_input,
            context=context,
            hypotheses=hypotheses,
            readiness_state=readiness_state,
            style_hint=style_hint,
            response_language=response_language,
            include_followup_prompt=include_followup_prompt,
        )
        draft_plan = self._plan_token_budget(user_input=user_input, messages=draft_messages, requested_max_tokens=max_tokens)
        messages = self.prompt_builder.build_messages(
            user_input=user_input,
            context=context,
            hypotheses=hypotheses,
            readiness_state=readiness_state,
            style_hint=style_hint,
            response_plan={"target_tokens": draft_plan.target_output_tokens},
            response_language=response_language,
            include_followup_prompt=include_followup_prompt,
        )
        token_plan = self._plan_token_budget(
            user_input=user_input,
            messages=messages,
            requested_max_tokens=draft_plan.target_output_tokens,
        )
        request = self.engine_client.build_request(
            messages=messages,
            max_tokens=token_plan.target_output_tokens,
            temperature=temperature,
            top_p=top_p,
            trace_id=trace,
            metadata={
                "anm_token_plan": token_plan.as_dict(),
                "anm_response_strategy": {
                    "inicio_meio_fim": True,
                    "followup_prompt_included": bool(include_followup_prompt),
                },
            },
        )
        payload = self.engine_client.engine_request_to_payload(request)
        raw = self.engine_client.invoke(payload, trace_id=trace)
        return self.response_parser.parse(raw, trace_id=trace)
