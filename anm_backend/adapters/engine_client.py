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
import subprocess
from dataclasses import dataclass
from ipaddress import ip_address
from time import perf_counter
from typing import Any, Dict, Tuple
from urllib import error, request
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

from anm_backend.audit import audit_log
from anm_backend.contracts import EngineRequest, EngineResponse


def _pick_first_non_empty(*values: str | None) -> str:
    for value in values:
        candidate = str(value or "").strip()
        if candidate:
            return candidate
    return ""


def _is_truthy(value: str | None) -> bool:
    normalized = str(value or "").strip().lower()
    return normalized in {"1", "true", "yes", "on"}


def _wsl_discovery_enabled() -> bool:
    return _is_truthy(
        _pick_first_non_empty(
            os.getenv("ANM_ENGINE_WSL_DISCOVERY_ENABLED"),
            os.getenv("KNEXAI_LLM_WSL_DISCOVERY_ENABLED"),
            os.getenv("RAG_LLM_WSL_DISCOVERY_ENABLED"),
            "1" if os.name == "nt" else "0",
        )
    )


def _first_ipv4(value: str) -> str:
    for token in str(value or "").replace("\n", " ").split():
        try:
            parsed = ip_address(token.strip())
        except ValueError:
            continue
        if parsed.version == 4:
            return token.strip()
    return ""


def _discover_wsl_ipv4() -> str:
    if os.name != "nt":
        return ""
    try:
        result = subprocess.run(
            ["wsl", "-e", "bash", "-lc", "hostname -I"],
            capture_output=True,
            text=True,
            timeout=3.0,
            check=False,
        )
    except Exception:
        return ""
    if int(result.returncode) != 0:
        return ""
    return _first_ipv4(result.stdout)


def _derive_wsl_base_url(base_url: str) -> str:
    parsed = urlparse(str(base_url or "").strip())
    host = str(parsed.hostname or "").strip().lower()
    if not parsed.scheme or host not in {"127.0.0.1", "localhost"}:
        return ""
    wsl_ip = _discover_wsl_ipv4()
    if not wsl_ip:
        return ""
    netloc = wsl_ip if not parsed.port else f"{wsl_ip}:{parsed.port}"
    candidate = urlunparse((parsed.scheme, netloc, parsed.path or "", "", "", ""))
    return candidate.rstrip("/")


def _probe_models(base_url: str, api_key: str, *, timeout_seconds: float) -> bool:
    url = f"{base_url.rstrip('/')}/models"
    try:
        req = request.Request(url=url, method="GET", headers=_json_headers(api_key))
        with request.urlopen(req, timeout=max(1.0, min(timeout_seconds, 4.0))) as response:
            code = int(getattr(response, "status", 200))
        return code == 200
    except Exception:
        return False


def _resolve_best_base_url(*, base_url: str, api_key: str, timeout_seconds: float) -> str:
    normalized = str(base_url or "").strip().rstrip("/")
    if not normalized:
        return base_url

    candidates: list[str] = [normalized]
    if _wsl_discovery_enabled():
        wsl_candidate = _derive_wsl_base_url(normalized)
        if wsl_candidate and wsl_candidate not in candidates:
            candidates.append(wsl_candidate)

    for candidate in candidates:
        if _probe_models(candidate, api_key, timeout_seconds=timeout_seconds):
            return candidate
    return normalized


def _resolve_logical_model_name() -> str:
    explicit = _pick_first_non_empty(os.getenv("ANM_ENGINE_MODEL"), os.getenv("LLM_MODEL_NAME"))
    if explicit:
        return explicit

    legacy = _pick_first_non_empty(os.getenv("VLLM_MODEL"))
    if legacy and "/" not in legacy and "\\" not in legacy:
        return legacy

    return "mistral-awq"


def _resolve_model_candidates(requested_model: str) -> list[str]:
    local_model_path = _pick_first_non_empty(os.getenv("LOCAL_LLM_MODEL"))
    local_basename = local_model_path.replace("\\", "/").split("/")[-1] if local_model_path else ""
    embeddings_base = _pick_first_non_empty(os.getenv("EMBEDDINGS_BASE_PATH"), "models").replace("\\", "/").rstrip("/")
    default_local_model_path = _pick_first_non_empty(
        os.getenv("LOCAL_LLM_MODEL_DEFAULT"),
        f"{embeddings_base}/CModelosMistral-7B-Instruct-v0.2-AWQ",
    )
    candidates = [
        requested_model,
        _pick_first_non_empty(os.getenv("VLLM_MODEL")),
        local_model_path,
        local_basename,
        default_local_model_path,
    ]
    ordered = []
    seen = set()
    for candidate in candidates:
        normalized = str(candidate or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return ordered


def _prioritize_with_available_models(candidates: list[str], available_models: list[str]) -> list[str]:
    available = [str(item or "").strip() for item in available_models if str(item or "").strip()]
    if not available:
        return candidates
    available_set = set(available)
    prioritized = list(available)
    tail = [candidate for candidate in candidates if candidate not in available_set]
    ordered: list[str] = []
    seen = set()
    for candidate in prioritized + tail:
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        ordered.append(candidate)
    return ordered


def _is_model_not_found_error(status_code: int, body: str) -> bool:
    if status_code != 404:
        return False
    signal = (body or "").lower()
    return ("model" in signal and ("does not exist" in signal or "not found" in signal or "unknown" in signal)) or ("notfounderror" in signal)


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

        base_url = _pick_first_non_empty(
            os.getenv("ANM_ENGINE_BASE_URL"),
            os.getenv("LOCAL_LLM_BASE_URL"),
            os.getenv("LLM_BASE_URL"),
            os.getenv("VLLM_BASE_URL"),
            "http://127.0.0.1:8000/v1",
        ).rstrip("/")
        model_name = _resolve_logical_model_name()
        api_key = _pick_first_non_empty(
            os.getenv("ANM_ENGINE_API_KEY"),
            os.getenv("LOCAL_LLM_API_KEY"),
            os.getenv("VLLM_API_KEY"),
            os.getenv("LLM_API_KEY"),
            "token-local",
        )
        timeout_s_raw = _pick_first_non_empty(os.getenv("ANM_ENGINE_TIMEOUT_S"))
        timeout_ms_raw = _pick_first_non_empty(os.getenv("LLM_TIMEOUT_MS"), os.getenv("VLLM_TIMEOUT_MS"))
        if timeout_s_raw:
            timeout_seconds = float(timeout_s_raw)
        elif timeout_ms_raw:
            timeout_seconds = max(1.0, float(timeout_ms_raw) / 1000.0)
        else:
            timeout_seconds = 45.0
        base_url = _resolve_best_base_url(base_url=base_url, api_key=api_key, timeout_seconds=timeout_seconds)
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
        requested_model = str(payload.get("model", self.model_name))
        model_candidates = _resolve_model_candidates(requested_model)
        available_models = self._fetch_available_models()
        if available_models:
            seen = set(model_candidates)
            for model_id in available_models:
                normalized = str(model_id or "").strip()
                if not normalized or normalized in seen:
                    continue
                seen.add(normalized)
                model_candidates.append(normalized)
            model_candidates = _prioritize_with_available_models(model_candidates, available_models)

        for index, model_candidate in enumerate(model_candidates):
            payload_to_send = dict(payload)
            payload_to_send["model"] = model_candidate
            try:
                req = request.Request(
                    url=url,
                    data=json.dumps(payload_to_send).encode("utf-8"),
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
                        "model": model_candidate,
                        "base_url": self.base_url,
                        "latency_ms": latency_ms,
                        "success": True,
                        "error": None,
                    },
                    trace_id=trace_id,
                )
                if model_candidate != self.model_name:
                    self.model_name = model_candidate
                return parsed
            except error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")
                if _is_model_not_found_error(exc.code, body) and index < len(model_candidates) - 1:
                    continue
                err_text = f"engine_http_error status={exc.code} body={body[:300]}"
                break
            except error.URLError as exc:
                err_text = f"engine_unavailable reason={exc.reason}"
                break
            except TimeoutError:
                err_text = "engine_timeout"
                break
            except json.JSONDecodeError:
                err_text = "engine_invalid_json"
                break

        latency_ms = int((perf_counter() - started) * 1000)
        audit_log(
            component="adapters.engine_client",
            event="engine_invoked",
            payload={
                "trace_id": trace_id,
                "model": requested_model,
                "base_url": self.base_url,
                "latency_ms": latency_ms,
                "success": False,
                "error": err_text,
            },
            trace_id=trace_id,
        )
        raise RuntimeError(err_text)

    def _fetch_available_models(self) -> list[str]:
        """
        Purpose:
            Read available served model ids from engine `/models`.
        Parameters:
            None.
        Returns:
            list[str]: Ordered model ids, empty on failure.
        Side Effects:
            Performs one lightweight HTTP GET.
        RAM Impact:
            Temporary response buffers.
        Persistence Impact:
            None.
        Expected Failures:
            Never raises; returns empty list.
        """

        models_url = f"{self.base_url}/models"
        try:
            req = request.Request(models_url, method="GET", headers=_json_headers(self.api_key))
            with request.urlopen(req, timeout=self.timeout_seconds) as resp:
                raw = resp.read().decode("utf-8")
            payload = json.loads(raw)
        except Exception:
            return []

        data = payload.get("data") if isinstance(payload, dict) else []
        if not isinstance(data, list):
            return []
        result: list[str] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            model_id = str(item.get("id", "")).strip()
            if model_id:
                result.append(model_id)
        return result

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
