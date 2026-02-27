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

from dataclasses import dataclass
from typing import Dict, List
from uuid import uuid4

from anm_backend.adapters.engine_client import EngineClient
from anm_backend.adapters.prompt_builder import PromptBuilder
from anm_backend.adapters.response_parser import ResponseParser
from anm_backend.contracts import EngineResponse
from anm_backend.orchestrator.hypothesis_pool import Hypothesis


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
        messages = self.prompt_builder.build_messages(
            user_input=user_input,
            context=context,
            hypotheses=hypotheses,
            readiness_state=readiness_state,
            style_hint=style_hint,
        )
        request = self.engine_client.build_request(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            trace_id=trace,
        )
        payload = self.engine_client.engine_request_to_payload(request)
        raw = self.engine_client.invoke(payload, trace_id=trace)
        return self.response_parser.parse(raw, trace_id=trace)
