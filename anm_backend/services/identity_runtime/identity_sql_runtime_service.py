"""
FILE: services/identity_runtime/identity_sql_runtime_service.py
RESPONSIBILITY: Optional SQL persistence for identity runtime through PostgREST.
FLOW ROLE: Mirror runtime status, streams and identity events into knex_identity_runtime schema.
READS: Identity runtime snapshots and events.
RAM WRITES: Failure counters and local cache links.
PERSISTS: Runtime config, camera sources, stream health and identity events.
PRIMARY RISK: Persistence endpoint instability can reduce observability coverage.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Dict, Iterable, Optional
from urllib import error as urlerror
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from anm_backend.audit import audit_log
from anm_backend.services.identity_runtime.types import CameraSource, CameraStreamSession, IdentityEntity


def _normalize(value: Any) -> str:
    return str(value or "").strip()


def _truncate(value: Any, max_chars: int) -> str:
    text = _normalize(value)
    if len(text) <= max_chars:
        return text
    return f"{text[: max(8, max_chars - 3)].rstrip()}..."


@dataclass
class IdentitySqlRuntimeService:
    enabled: bool = field(default_factory=lambda: _normalize(os.getenv("ANM_IDENTITY_SQL_PERSIST_ENABLED")).lower() in {"1", "true", "yes", "on"})
    base_url: str = field(default_factory=lambda: _normalize(os.getenv("ANM_IDENTITY_SQL_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")))
    service_key: str = field(default_factory=lambda: _normalize(os.getenv("ANM_IDENTITY_SQL_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")))
    schema: str = field(default_factory=lambda: _normalize(os.getenv("ANM_IDENTITY_SQL_SCHEMA")) or "knex_identity_runtime")
    timeout_seconds: float = field(default_factory=lambda: max(0.5, float(os.getenv("ANM_IDENTITY_SQL_TIMEOUT_S", "2.5"))))
    failure_threshold: int = field(default_factory=lambda: max(1, int(os.getenv("ANM_IDENTITY_SQL_FAILURE_THRESHOLD", "3"))))
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _consecutive_failures: int = field(default=0, init=False, repr=False)

    def is_enabled(self) -> bool:
        return bool(self.enabled and self.base_url and self.service_key and self._consecutive_failures < self.failure_threshold)

    def upsert_runtime_config(
        self,
        *,
        runtime_key: str,
        auto_start_enabled: bool,
        runtime_enabled: bool,
        runtime_paused: bool,
        selected_source_id: Optional[str],
        state: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not self.is_enabled():
            return
        try:
            self._request(
                "POST",
                "identity_runtime_config",
                params={"on_conflict": "runtime_key"},
                payload=[
                    {
                        "runtime_key": _truncate(runtime_key or "default", 120),
                        "auto_start_enabled": bool(auto_start_enabled),
                        "runtime_enabled": bool(runtime_enabled),
                        "runtime_paused": bool(runtime_paused),
                        "selected_source_id": _truncate(selected_source_id, 120) or None,
                        "runtime_state": _truncate(state, 80) or "disabled",
                        "metadata": dict(metadata or {}),
                    }
                ],
                prefer="resolution=merge-duplicates,return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("upsert_runtime_config", exc)

    def upsert_camera_sources(self, sources: Iterable[CameraSource]) -> None:
        if not self.is_enabled():
            return
        rows = []
        for source in sources:
            rows.append(
                {
                    "source_key": _truncate(source.source_id, 120),
                    "name": _truncate(source.name, 220),
                    "source_type": _truncate(source.source_type, 80) or "external",
                    "device_ref": _truncate(source.device_ref, 500) or None,
                    "resolution": _truncate(source.resolution, 80) or None,
                    "fps": max(1, int(source.fps)),
                    "priority": max(1, int(source.priority)),
                    "is_active": bool(source.active),
                    "is_connected": bool(source.connected),
                    "last_heartbeat_at": source.last_heartbeat_at,
                    "metadata": dict(source.metadata or {}),
                }
            )
        if not rows:
            return
        try:
            self._request(
                "POST",
                "camera_sources",
                params={"on_conflict": "source_key"},
                payload=rows,
                prefer="resolution=merge-duplicates,return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("upsert_camera_sources", exc)

    def upsert_stream_session(self, session: CameraStreamSession) -> None:
        if not self.is_enabled():
            return
        try:
            self._request(
                "POST",
                "camera_stream_sessions",
                params={"on_conflict": "stream_key"},
                payload=[
                    {
                        "stream_key": _truncate(session.stream_id, 120),
                        "source_key": _truncate(session.source_id, 120),
                        "status": _truncate(session.status, 80),
                        "started_at": session.started_at,
                        "ended_at": session.ended_at,
                        "metadata": dict(session.metadata or {}),
                    }
                ],
                prefer="resolution=merge-duplicates,return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("upsert_stream_session", exc)

    def record_stream_health(self, session: CameraStreamSession) -> None:
        if not self.is_enabled():
            return
        try:
            self._request(
                "POST",
                "camera_stream_health",
                payload=[
                    {
                        "stream_key": _truncate(session.stream_id, 120),
                        "source_key": _truncate(session.source_id, 120),
                        "status": _truncate(session.status, 80),
                        "fps_observed": float(max(0.0, session.fps_observed)),
                        "latency_ms": max(0, int(session.latency_ms)),
                        "dropped_frames": max(0, int(session.dropped_frames)),
                        "health_payload": dict(session.metadata or {}),
                    }
                ],
                prefer="return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("record_stream_health", exc)

    def upsert_identity_entity(self, entity: IdentityEntity) -> None:
        if not self.is_enabled():
            return
        try:
            self._request(
                "POST",
                "identity_entities",
                params={"on_conflict": "entity_key"},
                payload=[
                    {
                        "entity_key": _truncate(entity.entity_id, 120),
                        "display_label": _truncate(entity.label, 220),
                        "entity_mode": entity.mode.value,
                        "confidence": float(max(0.0, min(1.0, entity.confidence))),
                        "source_key": _truncate(entity.source_id, 120) or None,
                        "voice_profile_key": _truncate(entity.voice_profile_id, 120) or None,
                        "nominal_name": _truncate(entity.nominal_name, 220) or None,
                        "first_seen_at": entity.first_seen_at,
                        "last_seen_at": entity.last_seen_at,
                        "metadata": dict(entity.metadata or {}),
                    }
                ],
                prefer="resolution=merge-duplicates,return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("upsert_identity_entity", exc)

    def record_presence_event(
        self,
        *,
        session_key: str,
        entity_key: str,
        event_type: str,
        source_key: Optional[str],
        confidence: float,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not self.is_enabled():
            return
        try:
            self._request(
                "POST",
                "identity_presence_events",
                payload=[
                    {
                        "session_key": _truncate(session_key or "runtime", 120),
                        "entity_key": _truncate(entity_key, 120),
                        "event_type": _truncate(event_type, 80),
                        "source_key": _truncate(source_key, 120) or None,
                        "confidence": float(max(0.0, min(1.0, confidence))),
                        "event_payload": dict(payload or {}),
                    }
                ],
                prefer="return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("record_presence_event", exc)

    def record_verification_event(
        self,
        *,
        session_key: str,
        entity_key: str,
        outcome: str,
        confidence: float,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not self.is_enabled():
            return
        try:
            self._request(
                "POST",
                "identity_verification_events",
                payload=[
                    {
                        "session_key": _truncate(session_key or "runtime", 120),
                        "entity_key": _truncate(entity_key, 120),
                        "verification_outcome": _truncate(outcome, 80),
                        "confidence": float(max(0.0, min(1.0, confidence))),
                        "event_payload": dict(payload or {}),
                    }
                ],
                prefer="return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("record_verification_event", exc)

    def upsert_source_routing(
        self,
        *,
        route_key: str,
        source_key: str,
        route_scope: str,
        active: bool = True,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not self.is_enabled():
            return
        try:
            self._request(
                "POST",
                "identity_source_routing",
                params={"on_conflict": "route_key"},
                payload=[
                    {
                        "route_key": _truncate(route_key, 120),
                        "source_key": _truncate(source_key, 120),
                        "route_scope": _truncate(route_scope, 120),
                        "is_active": bool(active),
                        "metadata": dict(metadata or {}),
                    }
                ],
                prefer="resolution=merge-duplicates,return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("upsert_source_routing", exc)

    def record_audit_log(self, *, event_name: str, payload: Optional[Dict[str, Any]] = None) -> None:
        if not self.is_enabled():
            return
        try:
            self._request(
                "POST",
                "identity_audit_logs",
                payload=[
                    {
                        "event_name": _truncate(event_name, 120),
                        "payload": dict(payload or {}),
                    }
                ],
                prefer="return=minimal",
            )
            self._register_success()
        except Exception as exc:  # noqa: BLE001
            self._handle_failure("record_audit_log", exc)

    def _request(
        self,
        method: str,
        table: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        payload: Optional[Any] = None,
        prefer: Optional[str] = None,
    ) -> Any:
        base = self.base_url.rstrip("/")
        endpoint = f"{base}/rest/v1/{_normalize(table)}"
        query: Dict[str, str] = {}
        for key, value in (params or {}).items():
            clean_key = _normalize(key)
            if not clean_key or value is None:
                continue
            query[clean_key] = str(value)
        if query:
            endpoint = f"{endpoint}?{urlencode(query, doseq=True)}"

        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Accept": "application/json",
            "Accept-Profile": self.schema,
        }
        method_name = _normalize(method).upper() or "GET"
        if method_name in {"POST", "PATCH", "PUT", "DELETE"}:
            headers["Content-Profile"] = self.schema
        if prefer:
            headers["Prefer"] = prefer

        body = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

        req = Request(endpoint, data=body, headers=headers, method=method_name)
        try:
            with urlopen(req, timeout=self.timeout_seconds) as response:  # noqa: S310
                raw = response.read()
                if not raw:
                    return None
                decoded = raw.decode("utf-8", errors="replace").strip()
                if not decoded:
                    return None
                try:
                    return json.loads(decoded)
                except json.JSONDecodeError:
                    return decoded
        except urlerror.HTTPError as exc:
            detail = ""
            try:
                detail = exc.read().decode("utf-8", errors="replace")
            except Exception:  # noqa: BLE001
                detail = ""
            raise RuntimeError(f"identity_sql_http_error:{exc.code}:{_truncate(detail or str(exc.reason), 500)}") from exc
        except urlerror.URLError as exc:
            raise RuntimeError(f"identity_sql_unreachable:{_truncate(exc.reason, 500)}") from exc

    def _register_success(self) -> None:
        with self._lock:
            self._consecutive_failures = 0

    def _register_failure(self) -> int:
        with self._lock:
            self._consecutive_failures += 1
            return self._consecutive_failures

    def _handle_failure(self, operation: str, exc: Exception) -> None:
        failures = self._register_failure()
        disabled = failures >= self.failure_threshold
        audit_log(
            component="identity_sql_runtime",
            event="operation_failed",
            payload={
                "operation": _truncate(operation, 120),
                "consecutive_failures": failures,
                "failure_threshold": self.failure_threshold,
                "disabled": disabled,
                "error": _truncate(str(exc), 500),
            },
        )

