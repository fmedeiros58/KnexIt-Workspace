"""
FILE: adapters/response_parser.py
RESPONSIBILITY: Parse raw engine payload into typed ANM response contract.
FLOW ROLE: Final adapter stage after engine invocation.
READS: Raw JSON response returned by engine client.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Silent parse fallback may hide malformed upstream payloads.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List

from anm_backend.contracts import EngineResponse


@dataclass
class ResponseParser:
    """
    Objective:
        Normalize engine output for ANM flow.
    Responsibilities:
        Extract text, usage and internal command signals.
    Limits:
        No memory mutation.
    Mutates:
        None.
    Must not:
        Call engine endpoint.
    """

    def parse(self, payload: Dict[str, Any], *, trace_id: str) -> EngineResponse:
        """
        Purpose:
            Parse OpenAI-compatible response payload.
        Parameters:
            payload: Raw engine response.
            trace_id: Trace id from request flow.
        Returns:
            EngineResponse: Typed parsed response.
        Side Effects:
            None.
        RAM Impact:
            Temporary structures for parsing.
        Persistence Impact:
            None.
        Expected Failures:
            None (safe fallback).
        """

        choices = payload.get("choices") or []
        first = choices[0] if choices else {}
        message = first.get("message") if isinstance(first, dict) else {}

        text = ""
        if isinstance(message, dict):
            text = str(message.get("content", "")).strip()
        if not text and isinstance(first, dict):
            text = str(first.get("text", "")).strip()

        command_signals: List[Dict[str, Any]] = []
        if "[command]" in text.lower():
            command_signals.append({"type": "embedded_command", "raw": text})

        return EngineResponse(
            trace_id=trace_id,
            model=str(payload.get("model", "unknown")),
            text=text,
            usage=dict(payload.get("usage", {})),
            raw=payload,
            command_signals=command_signals,
        )

    def as_dict(self, response: EngineResponse) -> Dict[str, Any]:
        """
        Purpose:
            Convert typed response to JSON-friendly dict.
        Parameters:
            response: Typed engine response.
        Returns:
            Dict[str, Any]: Dictionary payload.
        Side Effects:
            None.
        RAM Impact:
            Temporary dict allocation.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return asdict(response)
