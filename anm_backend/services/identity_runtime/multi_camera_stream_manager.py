"""
FILE: services/identity_runtime/multi_camera_stream_manager.py
RESPONSIBILITY: Manage active camera streams for identity runtime.
FLOW ROLE: Holds stream sessions and enables source switching without runtime restart.
READS: Source inventory from discovery manager.
RAM WRITES: Active stream session map.
PERSISTS: Optional stream events delegated to SQL runtime service.
PRIMARY RISK: Stream/session drift when source state changes quickly.
"""

from __future__ import annotations

from threading import RLock
from typing import Any, Dict, List, Optional
from uuid import uuid4

from anm_backend.services.identity_runtime.source_discovery_manager import SourceDiscoveryManager
from anm_backend.services.identity_runtime.types import CameraStreamSession, utc_now_iso


def _normalize(value: Any) -> str:
    return str(value or "").strip()


class MultiCameraStreamManager:
    """
    Objective:
        Keep multi-source stream state stable while runtime is active.
    Responsibilities:
        Start, pause, stop and switch stream sessions.
    Limits:
        Does not decode video frames; it tracks stream lifecycle metadata.
    """

    def __init__(self, source_manager: SourceDiscoveryManager) -> None:
        self.source_manager = source_manager
        self._lock = RLock()
        self._active_streams: Dict[str, CameraStreamSession] = {}
        self._selected_source_id: Optional[str] = None

    @property
    def selected_source_id(self) -> Optional[str]:
        with self._lock:
            return self._selected_source_id

    def set_selected_source(self, source_id: str) -> Optional[CameraStreamSession]:
        key = _normalize(source_id)
        if not key:
            return None
        source = self.source_manager.get_source(key)
        if not source or not source.connected:
            return None
        with self._lock:
            self._selected_source_id = key
        return self._ensure_stream_for_source(key)

    def sync_streams(self, *, runtime_enabled: bool, paused: bool) -> List[CameraStreamSession]:
        if not runtime_enabled:
            self.stop_all(reason="runtime_disabled")
            return []

        sources = self.source_manager.list_sources()
        allowed_sources = [item for item in sources if item.active and item.connected]
        allowed_ids = {item.source_id for item in allowed_sources}

        with self._lock:
            stale_sources = [source_id for source_id in self._active_streams if source_id not in allowed_ids]
            for source_id in stale_sources:
                session = self._active_streams[source_id]
                session.status = "stopped"
                session.ended_at = utc_now_iso()
                del self._active_streams[source_id]

            if paused:
                for session in self._active_streams.values():
                    session.status = "paused"
                    session.latency_ms = max(0, int(session.latency_ms))
                return list(self._active_streams.values())

            if self._selected_source_id and self._selected_source_id in allowed_ids:
                target_ids = {self._selected_source_id}
            else:
                target_ids = {item.source_id for item in allowed_sources}

            for source_id in target_ids:
                self._ensure_stream_for_source(source_id)

            for source_id, session in list(self._active_streams.items()):
                if source_id in target_ids:
                    session.status = "active"
                    session.ended_at = None
                    session.fps_observed = max(1.0, session.fps_observed or 1.0)
                    session.latency_ms = max(0, session.latency_ms)
                else:
                    session.status = "paused"

            return list(self._active_streams.values())

    def mark_stream_health(
        self,
        *,
        source_id: str,
        fps_observed: float,
        latency_ms: int,
        dropped_frames_inc: int = 0,
    ) -> Optional[CameraStreamSession]:
        key = _normalize(source_id)
        if not key:
            return None
        with self._lock:
            session = self._active_streams.get(key)
            if not session:
                return None
            session.fps_observed = max(0.0, float(fps_observed))
            session.latency_ms = max(0, int(latency_ms))
            session.dropped_frames = max(0, int(session.dropped_frames) + int(dropped_frames_inc))
            session.metadata["last_health_update_at"] = utc_now_iso()
            return session

    def list_active_streams(self) -> List[CameraStreamSession]:
        with self._lock:
            return list(self._active_streams.values())

    def pause_all(self, *, reason: str = "manual_pause") -> None:
        with self._lock:
            for session in self._active_streams.values():
                session.status = "paused"
                session.metadata["pause_reason"] = reason

    def resume_all(self) -> None:
        with self._lock:
            for session in self._active_streams.values():
                session.status = "active"
                session.metadata.pop("pause_reason", None)

    def stop_all(self, *, reason: str = "manual_stop") -> None:
        with self._lock:
            for session in self._active_streams.values():
                session.status = "stopped"
                session.ended_at = utc_now_iso()
                session.metadata["stop_reason"] = reason
            self._active_streams.clear()

    def _ensure_stream_for_source(self, source_id: str) -> Optional[CameraStreamSession]:
        with self._lock:
            existing = self._active_streams.get(source_id)
            if existing:
                if existing.status in {"stopped", "error"}:
                    existing.status = "active"
                    existing.ended_at = None
                return existing
            source = self.source_manager.get_source(source_id)
            if not source:
                return None
            session = CameraStreamSession(
                stream_id=f"stream-{uuid4()}",
                source_id=source.source_id,
                status="active",
                fps_observed=float(max(1, int(source.fps))),
                latency_ms=0,
                dropped_frames=0,
                metadata={"source_name": source.name, "source_type": source.source_type},
            )
            self._active_streams[source.source_id] = session
            return session

