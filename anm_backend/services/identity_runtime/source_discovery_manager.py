"""
FILE: services/identity_runtime/source_discovery_manager.py
RESPONSIBILITY: Discover and maintain camera source inventory for identity runtime.
FLOW ROLE: Supplies available capture sources to stream manager and control API.
READS: Environment seed configuration and in-memory source map.
RAM WRITES: Camera source catalog.
PERSISTS: Optional persistence delegated to SQL runtime service.
PRIMARY RISK: Source metadata drift without explicit refresh.
"""

from __future__ import annotations

import json
import os
from threading import RLock
from typing import Any, Dict, List, Optional

from anm_backend.services.identity_runtime.types import CameraSource, utc_now_iso


def _normalize(value: Any) -> str:
    return str(value or "").strip()


def _to_int(value: Any, default: int, low: int, high: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(low, min(high, parsed))


class SourceDiscoveryManager:
    """
    Objective:
        Provide continuous source discovery for identity runtime.
    Responsibilities:
        Track camera sources and expose current catalog.
    Limits:
        Does not open streams; it only inventories sources.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._sources: Dict[str, CameraSource] = {}
        self._last_refresh_at = ""
        self.discover_sources(force=True)

    def discover_sources(self, *, force: bool = False) -> List[CameraSource]:
        with self._lock:
            if self._sources and not force:
                return self.list_sources()

            discovered = self._load_seed_sources()
            if not discovered:
                discovered = [
                    CameraSource(
                        source_id="webcam-main",
                        name="Webcam principal",
                        source_type="local",
                        device_ref="device://0",
                        resolution="1280x720",
                        fps=30,
                        priority=100,
                        active=True,
                        connected=True,
                        metadata={"origin": "default_seed"},
                    )
                ]
            self._sources = {item.source_id: item for item in discovered}
            self._last_refresh_at = utc_now_iso()
            return self.list_sources()

    def list_sources(self) -> List[CameraSource]:
        with self._lock:
            rows = list(self._sources.values())
        rows.sort(key=lambda item: (item.priority, item.name.lower()))
        return rows

    def get_source(self, source_id: str) -> Optional[CameraSource]:
        key = _normalize(source_id)
        if not key:
            return None
        with self._lock:
            source = self._sources.get(key)
        return source

    def upsert_source(self, payload: Dict[str, Any]) -> CameraSource:
        source = self._build_source(payload)
        with self._lock:
            current = self._sources.get(source.source_id)
            if current:
                source.last_heartbeat_at = current.last_heartbeat_at
            self._sources[source.source_id] = source
        return source

    def set_source_activity(self, source_id: str, *, active: bool) -> Optional[CameraSource]:
        key = _normalize(source_id)
        if not key:
            return None
        with self._lock:
            current = self._sources.get(key)
            if not current:
                return None
            current.active = bool(active)
            current.last_heartbeat_at = utc_now_iso()
            return current

    def set_source_connectivity(self, source_id: str, *, connected: bool) -> Optional[CameraSource]:
        key = _normalize(source_id)
        if not key:
            return None
        with self._lock:
            current = self._sources.get(key)
            if not current:
                return None
            current.connected = bool(connected)
            current.last_heartbeat_at = utc_now_iso()
            return current

    def mark_heartbeat(self, source_id: str) -> None:
        key = _normalize(source_id)
        if not key:
            return
        with self._lock:
            current = self._sources.get(key)
            if not current:
                return
            current.last_heartbeat_at = utc_now_iso()

    def discovery_snapshot(self) -> Dict[str, Any]:
        with self._lock:
            count = len(self._sources)
            active = len([item for item in self._sources.values() if item.active and item.connected])
            disconnected = len([item for item in self._sources.values() if not item.connected])
            refreshed = self._last_refresh_at
        return {
            "total_sources": count,
            "active_sources": active,
            "disconnected_sources": disconnected,
            "last_refresh_at": refreshed,
        }

    def _load_seed_sources(self) -> List[CameraSource]:
        raw = _normalize(os.getenv("ANM_IDENTITY_SOURCE_LIST"))
        if not raw:
            return []
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return []

        rows: List[Dict[str, Any]] = []
        if isinstance(payload, list):
            rows = [item for item in payload if isinstance(item, dict)]
        elif isinstance(payload, dict):
            rows = [payload]
        else:
            return []
        return [self._build_source(item) for item in rows if _normalize(item.get("source_id") or item.get("id"))]

    def _build_source(self, payload: Dict[str, Any]) -> CameraSource:
        source_id = _normalize(payload.get("source_id") or payload.get("id")) or "source-unknown"
        source_type = _normalize(payload.get("source_type") or payload.get("type")).lower()
        if source_type not in {"local", "external", "virtual", "ip"}:
            source_type = "external"
        return CameraSource(
            source_id=source_id,
            name=_normalize(payload.get("name")) or source_id,
            source_type=source_type,
            device_ref=_normalize(payload.get("device_ref") or payload.get("device") or payload.get("url")),
            resolution=_normalize(payload.get("resolution")) or "1280x720",
            fps=_to_int(payload.get("fps"), 30, 1, 120),
            priority=_to_int(payload.get("priority"), 100, 1, 1000),
            active=bool(payload.get("active", True)),
            connected=bool(payload.get("connected", True)),
            metadata=dict(payload.get("metadata") or {}),
        )

