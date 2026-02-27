"""
FILE: adapters/engine_client.py
RESPONSIBILITY: Real integration client for local engine endpoint.
FLOW ROLE: Single transport boundary for ANM -> engine communication.
READS: Engine request payload and environment configuration.
RAM WRITES: Temporary request/response buffers.
PERSISTS: None.
PRIMARY RISK: Upstream engine downtime/timeouts.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from time import perf_counter
from typing import Any, Dict, Tuple
from urllib import error, request
from uuid import uuid4

from anm_backend.audit import audit_log
from anm_backend.contracts import EngineRequest, EngineResponse


def _json_headers(api_key: str) -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


@dataclass
class EngineClient:
    """
    Objective:
        Invoke the real local engine endpoint.
    Responsibilities:
        Build HTTP calls, return parsed payloads and expose health checks.
    Limits:
        No prompt strategy or memory orchestration.
    Mutates:
        None outside temporary buffers.
    Must not:
        Return simulated/fake responses.
    """

    base_url: str
    model_name: str
    api_key: str = ""
    timeout_seconds: float = 45.0

    @classmethod
    def from_env(cls) -> "EngineClient":
        """
        Purpose:
            Build engine client from explicit ANM environment variables.
        Parameters:
            None.
        Returns:
            EngineClient: Configured client.
        Side Effects:
            Reads process environment.
        RAM Impact:
            Allocates client instance.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        base_url = os.getenv(
            "ANM_ENGINE_BASE_URL",
            os.getenv("LLM_BASE_URL", os.getenv("VLLM_BASE_URL", "http://127.0.0.1:8000/v1")),
        ).rstrip("/")
        model_name = os.getenv("ANM_ENGINE_MODEL", os.getenv("LLM_MODEL_NAME", os.getenv("VLLM_MODEL", "mistral-awq")))
        api_key = os.getenv("ANM_ENGINE_API_KEY", os.getenv("LLM_API_KEY", os.getenv("VLLM_API_KEY", "")))
        timeout_seconds = float(os.getenv("ANM_ENGINE_TIMEOUT_S", os.getenv("LLM_TIMEOUT_SECONDS", "45")))
        return cls(base_url=base_url, model_name=model_name, api_key=api_key, timeout_seconds=timeout_seconds)

    def build_request(
        self,
        *,
        messages: list[dict[str, str]],
        max_tokens: int = 512,
        temperature: float = 0.3,
        top_p: float = 0.9,
        trace_id: str | None = None,
        metadata: Dict[str, Any] | None = None,
    ) -> EngineRequest:
        """
        Purpose:
            Build typed engine request from ANM adapter inputs.
        Parameters:
            messages: OpenAI-like chat messages.
            max_tokens: Token budget.
            temperature: Sampling temperature.
            top_p: Nucleus sampling.
            trace_id: Optional trace id.
            metadata: Optional metadata.
        Returns:
            EngineRequest: Typed request object.
        Side Effects:
            None.
        RAM Impact:
            Temporary dataclass allocation.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return EngineRequest(
            trace_id=trace_id or f"trace-{uuid4()}",
            messages=messages,
            model=self.model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            metadata=dict(metadata or {}),
        )

    def engine_request_to_payload(self, req: EngineRequest) -> Dict[str, Any]:
        """
        Purpose:
            Transform EngineRequest into real HTTP payload.
        Parameters:
            req: Typed request object.
        Returns:
            Dict[str, Any]: JSON-ready payload.
        Side Effects:
            None.
        RAM Impact:
            Temporary dict allocation.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        payload: Dict[str, Any] = {
            "model": req.model or self.model_name,
            "messages": req.messages,
            "max_tokens": req.max_tokens,
            "temperature": req.temperature,
            "top_p": req.top_p,
            "stream": False,
        }
        if req.metadata:
            payload["metadata"] = dict(req.metadata)
        return payload

    def invoke(self, payload: Dict[str, Any], *, trace_id: str) -> Dict[str, Any]:
        """
        Purpose:
            Perform real HTTP invocation against local engine.
        Parameters:
            payload: JSON payload for `/chat/completions`.
            trace_id: Request trace id.
        Returns:
            Dict[str, Any]: Parsed JSON response from engine.
        Side Effects:
            Emits `engine_invoked` audit log with latency/success/error.
        RAM Impact:
            Temporary HTTP buffers.
        Persistence Impact:
            None.
        Expected Failures:
            RuntimeError on HTTP/network/timeout/JSON errors.
        """

        url = f"{self.base_url}/chat/completions"
        started = perf_counter()
        err_text = ""
        try:
            req = request.Request(
                url=url,
                data=json.dumps(payload).encode("utf-8"),
                method="POST",
                headers=_json_headers(self.api_key),
            )
            with request.urlopen(req, timeout=self.timeout_seconds) as resp:
                raw = resp.read().decode("utf-8")
            parsed = json.loads(raw)
            latency_ms = int((perf_counter() - started) * 1000)
            audit_log(
                component="adapters.engine_client",
                event="engine_invoked",
                payload={
                    "trace_id": trace_id,
                    "model": str(payload.get("model", self.model_name)),
                    "base_url": self.base_url,
                    "latency_ms": latency_ms,
                    "success": True,
                    "error": None,
                },
                trace_id=trace_id,
            )
            return parsed
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            err_text = f"engine_http_error status={exc.code} body={body[:300]}"
        except error.URLError as exc:
            err_text = f"engine_unavailable reason={exc.reason}"
        except TimeoutError:
            err_text = "engine_timeout"
        except json.JSONDecodeError:
            err_text = "engine_invalid_json"

        latency_ms = int((perf_counter() - started) * 1000)
        audit_log(
            component="adapters.engine_client",
            event="engine_invoked",
            payload={
                "trace_id": trace_id,
                "model": str(payload.get("model", self.model_name)),
                "base_url": self.base_url,
                "latency_ms": latency_ms,
                "success": False,
                "error": err_text,
            },
            trace_id=trace_id,
        )
        raise RuntimeError(err_text)

    def parse_engine_response(self, raw: Dict[str, Any], *, trace_id: str) -> EngineResponse:
        """
        Purpose:
            Transform raw engine payload into EngineResponse.
        Parameters:
            raw: Raw engine payload.
            trace_id: Trace id.
        Returns:
            EngineResponse: Structured engine response.
        Side Effects:
            None.
        RAM Impact:
            Temporary parsing allocations.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        choices = raw.get("choices") or []
        first = choices[0] if choices else {}
        message = first.get("message") if isinstance(first, dict) else {}
        text = ""
        if isinstance(message, dict):
            text = str(message.get("content", "")).strip()
        if not text and isinstance(first, dict):
            text = str(first.get("text", "")).strip()
        return EngineResponse(
            trace_id=trace_id,
            model=str(raw.get("model", self.model_name)),
            text=text,
            usage=dict(raw.get("usage", {})),
            raw=raw,
            command_signals=[],
        )

    def health(self) -> Dict[str, Any]:
        """
        Purpose:
            Execute real engine health probe.
        Parameters:
            None.
        Returns:
            Dict[str, Any]: Probe status with latency and model.
        Side Effects:
            Performs real HTTP request(s) to engine.
        RAM Impact:
            Temporary response buffers.
        Persistence Impact:
            None.
        Expected Failures:
            Never raises; returns `ok=False` with error.
        """

        started = perf_counter()
        trace_id = f"trace-health-{uuid4()}"
        model = self.model_name
        try:
            # First probe: OpenAI-like `GET /models`.
            models_url = f"{self.base_url}/models"
            req = request.Request(models_url, method="GET", headers=_json_headers(self.api_key))
            with request.urlopen(req, timeout=self.timeout_seconds) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            data = payload.get("data") or []
            if data and isinstance(data[0], dict) and data[0].get("id"):
                model = str(data[0]["id"])
            latency_ms = int((perf_counter() - started) * 1000)
            audit_log(
                component="adapters.engine_client",
                event="engine_invoked",
                payload={
                    "trace_id": trace_id,
                    "model": model,
                    "base_url": self.base_url,
                    "latency_ms": latency_ms,
                    "success": True,
                    "error": None,
                },
                trace_id=trace_id,
            )
            return {"ok": True, "latency_ms": latency_ms, "model": model, "error": None}
        except Exception as first_error:  # noqa: BLE001
            latency_ms = int((perf_counter() - started) * 1000)
            audit_log(
                component="adapters.engine_client",
                event="engine_invoked",
                payload={
                    "trace_id": trace_id,
                    "model": model,
                    "base_url": self.base_url,
                    "latency_ms": latency_ms,
                    "success": False,
                    "error": str(first_error),
                },
                trace_id=trace_id,
            )
            # Second probe: real tiny completion request.
            trace = f"trace-health-fallback-{uuid4()}"
            try:
                req_obj = self.build_request(
                    messages=[{"role": "user", "content": "responda apenas: ok"}],
                    max_tokens=8,
                    temperature=0.0,
                    top_p=1.0,
                    trace_id=trace,
                )
                raw = self.invoke(self.engine_request_to_payload(req_obj), trace_id=trace)
                parsed = self.parse_engine_response(raw, trace_id=trace)
                latency_ms = int((perf_counter() - started) * 1000)
                return {"ok": True, "latency_ms": latency_ms, "model": parsed.model or model, "error": None}
            except Exception as second_error:  # noqa: BLE001
                latency_ms = int((perf_counter() - started) * 1000)
                return {
                    "ok": False,
                    "latency_ms": latency_ms,
                    "model": model,
                    "error": f"{first_error}; fallback={second_error}",
                }
