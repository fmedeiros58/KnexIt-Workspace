"""
FILE: services/identity_runtime/continuous_identity_runtime.py
RESPONSIBILITY: Continuous background identity runtime orchestration.
FLOW ROLE: Keep detection/tracking/reidentification states alive independently of composer actions.
READS: Source catalog and incoming sensing observations.
RAM WRITES: Runtime state, tracked entities and awareness state.
PERSISTS: Optional runtime and event telemetry through SQL runtime service.
PRIMARY RISK: State transitions can drift if event stream is inconsistent.
"""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from anm_backend.audit import audit_log
from anm_backend.services.identity_runtime.identity_sql_runtime_service import IdentitySqlRuntimeService
from anm_backend.services.identity_runtime.multi_camera_stream_manager import MultiCameraStreamManager
from anm_backend.services.identity_runtime.source_discovery_manager import SourceDiscoveryManager
from anm_backend.services.identity_runtime.types import (
    CameraSource,
    IdentityEntity,
    IdentityMode,
    IdentityRuntimeSnapshot,
    IdentityRuntimeStatus,
    utc_now_iso,
)


def _normalize(value: Any) -> str:
    return str(value or "").strip()


def _env_bool(name: str, *, default: bool = False) -> bool:
    raw = _normalize(os.getenv(name) or ("1" if default else "0")).lower()
    return raw in {"1", "true", "yes", "on"}


def _env_int(name: str, *, default: int, low: int, high: int) -> int:
    try:
        parsed = int(_normalize(os.getenv(name) or str(default)))
    except ValueError:
        parsed = default
    return max(low, min(high, parsed))


@dataclass
class ContinuousIdentityRuntime:
    source_manager: SourceDiscoveryManager
    stream_manager: MultiCameraStreamManager
    sql_runtime_service: IdentitySqlRuntimeService = field(default_factory=IdentitySqlRuntimeService)
    runtime_key: str = field(default_factory=lambda: _normalize(os.getenv("ANM_IDENTITY_RUNTIME_KEY")) or "default")
    auto_start_enabled: bool = field(
        default_factory=lambda: _env_bool("ANM_IDENTITY_RUNTIME_PERSISTENT_ENABLED", default=False)
    )
    runtime_enabled: bool = False
    runtime_paused: bool = False
    status: IdentityRuntimeStatus = IdentityRuntimeStatus.DISABLED
    last_error: str = ""
    selected_source_id: Optional[str] = None
    _lock: threading.RLock = field(default_factory=threading.RLock, init=False, repr=False)
    _stop_event: threading.Event = field(default_factory=threading.Event, init=False, repr=False)
    _worker: Optional[threading.Thread] = field(default=None, init=False, repr=False)
    _pending_observations: List[Dict[str, Any]] = field(default_factory=list, init=False, repr=False)
    _tracked_entities: Dict[str, IdentityEntity] = field(default_factory=dict, init=False, repr=False)
    _current_entity_id: Optional[str] = None
    _awareness_state: Dict[str, Any] = field(
        default_factory=lambda: {
            "someone_in_frame": False,
            "camera_source_id": None,
            "known_face": False,
            "identity_confirmed": False,
            "identity_conflict": False,
            "interlocutor_switched": False,
            "self_user_present": False,
            "visual_source": None,
            "last_transition_at": None,
        },
        init=False,
    )

    def bootstrap(self, *, reason: str = "application_boot") -> None:
        try:
            self.source_manager.discover_sources(force=True)
            if self.auto_start_enabled:
                self.enable_runtime(reason=reason, persist=True)
            else:
                self.status = IdentityRuntimeStatus.DISABLED
                self._persist_runtime_config()
        except Exception as exc:  # noqa: BLE001
            self.last_error = str(exc)
            self.status = IdentityRuntimeStatus.DEGRADED
            self._audit("bootstrap_failed", {"reason": reason, "error": self.last_error})

    def shutdown(self) -> None:
        self._stop_worker()
        self.stream_manager.stop_all(reason="runtime_shutdown")
        with self._lock:
            self.runtime_enabled = False
            self.runtime_paused = False
            self.status = IdentityRuntimeStatus.DISABLED
        self._persist_runtime_config()

    def set_auto_start(self, enabled: bool) -> None:
        with self._lock:
            self.auto_start_enabled = bool(enabled)
        self._persist_runtime_config()

    def enable_runtime(self, *, reason: str = "manual_enable", persist: bool = True) -> None:
        with self._lock:
            self.runtime_enabled = True
            self.runtime_paused = False
            self.status = IdentityRuntimeStatus.ENABLED_IDLE
            self.last_error = ""
        self._ensure_worker()
        if persist:
            self._persist_runtime_config()
        self._audit("runtime_enabled", {"reason": reason})

    def disable_runtime(self, *, reason: str = "manual_disable", persist: bool = True) -> None:
        self.stream_manager.stop_all(reason=reason)
        with self._lock:
            self.runtime_enabled = False
            self.runtime_paused = False
            self.status = IdentityRuntimeStatus.DISABLED
            self._awareness_state["someone_in_frame"] = False
            self._awareness_state["identity_confirmed"] = False
            self._awareness_state["identity_conflict"] = False
        if persist:
            self._persist_runtime_config()
        self._audit("runtime_disabled", {"reason": reason})

    def pause_runtime(self, *, reason: str = "manual_pause") -> None:
        with self._lock:
            if not self.runtime_enabled:
                return
            self.runtime_paused = True
            self.status = IdentityRuntimeStatus.PAUSED
        self.stream_manager.pause_all(reason=reason)
        self._persist_runtime_config()
        self._audit("runtime_paused", {"reason": reason})

    def resume_runtime(self, *, reason: str = "manual_resume") -> None:
        with self._lock:
            if not self.runtime_enabled:
                return
            self.runtime_paused = False
            self.status = IdentityRuntimeStatus.ENABLED_IDLE
        self.stream_manager.resume_all()
        self._persist_runtime_config()
        self._audit("runtime_resumed", {"reason": reason})

    def refresh_sources(self) -> List[CameraSource]:
        sources = self.source_manager.discover_sources(force=True)
        self.sql_runtime_service.upsert_camera_sources(sources)
        return sources

    def register_or_update_source(self, payload: Dict[str, Any]) -> CameraSource:
        source = self.source_manager.upsert_source(payload)
        self.sql_runtime_service.upsert_camera_sources([source])
        return source

    def set_source_active(self, source_id: str, *, active: bool) -> Optional[CameraSource]:
        source = self.source_manager.set_source_activity(source_id, active=active)
        if source:
            self.sql_runtime_service.upsert_camera_sources([source])
        return source

    def select_source(self, source_id: str) -> bool:
        session = self.stream_manager.set_selected_source(source_id)
        if not session:
            return False
        with self._lock:
            self.selected_source_id = source_id
            self._awareness_state["camera_source_id"] = source_id
            self._awareness_state["visual_source"] = source_id
        self.sql_runtime_service.upsert_source_routing(
            route_key=f"{self.runtime_key}:active",
            source_key=source_id,
            route_scope="identity_runtime",
            active=True,
            metadata={"selected_at": utc_now_iso()},
        )
        self._persist_runtime_config()
        return True

    def submit_observation(self, payload: Dict[str, Any]) -> None:
        with self._lock:
            self._pending_observations.append(dict(payload or {}))

    def get_status(self) -> IdentityRuntimeStatus:
        with self._lock:
            return self.status

    def tracked_entities(self) -> List[IdentityEntity]:
        with self._lock:
            items = list(self._tracked_entities.values())
        items.sort(key=lambda item: item.last_seen_at, reverse=True)
        return items

    def current_identity(self) -> Optional[IdentityEntity]:
        with self._lock:
            if not self._current_entity_id:
                return None
            return self._tracked_entities.get(self._current_entity_id)

    def awareness_state(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._awareness_state)

    def snapshot(
        self,
        *,
        self_model_state: Optional[Dict[str, Any]] = None,
        user_pattern_state: Optional[Dict[str, Any]] = None,
    ) -> IdentityRuntimeSnapshot:
        with self._lock:
            status = self.status
            runtime_enabled = self.runtime_enabled
            runtime_paused = self.runtime_paused
            auto_start_enabled = self.auto_start_enabled
            selected_source_id = self.selected_source_id
            awareness_state = dict(self._awareness_state)
            last_error = self.last_error
        streams = self.stream_manager.list_active_streams()
        sources = self.source_manager.list_sources()
        tracked = self.tracked_entities()
        current = self.current_identity()
        return IdentityRuntimeSnapshot(
            status=status,
            runtime_enabled=runtime_enabled,
            runtime_paused=runtime_paused,
            auto_start_enabled=auto_start_enabled,
            selected_source_id=selected_source_id,
            active_streams=streams,
            camera_sources=sources,
            tracked_entities=tracked,
            current_identity=current,
            awareness_state=awareness_state,
            self_model_state=dict(self_model_state or {}),
            user_pattern_state=dict(user_pattern_state or {}),
            last_error=last_error,
        )

    def _ensure_worker(self) -> None:
        with self._lock:
            if self._worker and self._worker.is_alive():
                return
            self._stop_event.clear()
            self._worker = threading.Thread(target=self._worker_loop, name="anm-identity-runtime", daemon=True)
            self._worker.start()

    def _stop_worker(self) -> None:
        with self._lock:
            worker = self._worker
            self._stop_event.set()
        if worker and worker.is_alive():
            worker.join(timeout=2.5)

    def _worker_loop(self) -> None:
        tick_ms = _env_int("ANM_IDENTITY_RUNTIME_TICK_MS", default=700, low=150, high=5000)
        while not self._stop_event.is_set():
            try:
                self._runtime_tick()
            except Exception as exc:  # noqa: BLE001
                with self._lock:
                    self.last_error = str(exc)
                    self.status = IdentityRuntimeStatus.DEGRADED
                self._audit("runtime_tick_failed", {"error": self.last_error})
            time.sleep(tick_ms / 1000.0)

    def _runtime_tick(self) -> None:
        with self._lock:
            if not self.runtime_enabled:
                self.status = IdentityRuntimeStatus.DISABLED
                return
            paused = self.runtime_paused

        self.source_manager.discover_sources(force=False)
        streams = self.stream_manager.sync_streams(runtime_enabled=True, paused=paused)
        self.sql_runtime_service.upsert_camera_sources(self.source_manager.list_sources())

        if paused:
            with self._lock:
                self.status = IdentityRuntimeStatus.PAUSED
            self._persist_runtime_config()
            return

        if not streams:
            with self._lock:
                self.status = IdentityRuntimeStatus.ENABLED_IDLE
            self._persist_runtime_config()
            return

        with self._lock:
            self.status = IdentityRuntimeStatus.MONITORING
            if not self.selected_source_id:
                self.selected_source_id = streams[0].source_id
            self._awareness_state["camera_source_id"] = self.selected_source_id
            self._awareness_state["visual_source"] = self.selected_source_id

        for stream in streams:
            self.source_manager.mark_heartbeat(stream.source_id)
            self.sql_runtime_service.upsert_stream_session(stream)
            self.sql_runtime_service.record_stream_health(stream)

        self._process_pending_observations()
        self._refresh_degraded_state(streams)
        self._persist_runtime_config()

    def _refresh_degraded_state(self, streams: List[Any]) -> None:
        min_fps = _env_int("ANM_IDENTITY_MIN_HEALTHY_FPS", default=6, low=1, high=120)
        unhealthy = [item for item in streams if float(item.fps_observed) < float(min_fps)]
        if not unhealthy:
            return
        with self._lock:
            if self.status in {IdentityRuntimeStatus.PAUSED, IdentityRuntimeStatus.DISABLED}:
                return
            self.status = IdentityRuntimeStatus.DEGRADED
            self.last_error = f"stream_fps_below_threshold:{min_fps}"

    def _process_pending_observations(self) -> None:
        with self._lock:
            queue = list(self._pending_observations)
            self._pending_observations.clear()
        for observation in queue:
            self._apply_observation(observation)

    def _apply_observation(self, observation: Dict[str, Any]) -> None:
        face_detected = bool(observation.get("face_detected", True))
        if not face_detected:
            with self._lock:
                self._awareness_state["someone_in_frame"] = False
                self._awareness_state["identity_confirmed"] = False
                self._awareness_state["known_face"] = False
                self._awareness_state["identity_conflict"] = False
                if self.status not in {IdentityRuntimeStatus.PAUSED, IdentityRuntimeStatus.DISABLED}:
                    self.status = IdentityRuntimeStatus.MONITORING
            return

        source_id = _normalize(observation.get("source_id")) or self.selected_source_id or ""
        entity_id = _normalize(observation.get("entity_id")) or f"person_{max(1, len(self._tracked_entities) + 1):02d}"
        confidence = max(0.0, min(1.0, float(observation.get("confidence", 0.62))))
        mode_raw = _normalize(observation.get("mode") or "tracking").lower()
        mode_map = {
            "detection": IdentityMode.DETECTION,
            "tracking": IdentityMode.TRACKING,
            "reidentification": IdentityMode.REIDENTIFICATION,
            "verification": IdentityMode.VERIFICATION,
            "nominal_identification": IdentityMode.NOMINAL_IDENTIFICATION,
        }
        mode = mode_map.get(mode_raw, IdentityMode.TRACKING)
        nominal_name = _normalize(observation.get("nominal_name")) or None
        label = _normalize(observation.get("label")) or entity_id
        speaker_id = _normalize(observation.get("speaker_id")) or None
        validation_pending = bool(observation.get("validation_pending", False))
        conflict = bool(observation.get("conflict", False))
        self_user_present = bool(observation.get("self_user_present", False))

        with self._lock:
            previous_entity = self._current_entity_id
            entity = self._tracked_entities.get(entity_id)
            if entity is None:
                entity = IdentityEntity(
                    entity_id=entity_id,
                    label=label,
                    mode=mode,
                    confidence=confidence,
                    source_id=source_id or None,
                    voice_profile_id=speaker_id,
                    nominal_name=nominal_name,
                    metadata={"created_by_runtime": True},
                )
                self._tracked_entities[entity_id] = entity
            else:
                entity.label = label
                entity.mode = mode
                entity.confidence = confidence
                entity.source_id = source_id or entity.source_id
                entity.voice_profile_id = speaker_id or entity.voice_profile_id
                entity.nominal_name = nominal_name or entity.nominal_name
                entity.last_seen_at = utc_now_iso()

            self._current_entity_id = entity_id
            switched = bool(previous_entity and previous_entity != entity_id)
            self._awareness_state["someone_in_frame"] = True
            self._awareness_state["camera_source_id"] = source_id or self.selected_source_id
            self._awareness_state["visual_source"] = source_id or self.selected_source_id
            self._awareness_state["known_face"] = True
            self._awareness_state["interlocutor_switched"] = switched
            self._awareness_state["self_user_present"] = self_user_present
            self._awareness_state["last_transition_at"] = utc_now_iso() if switched else self._awareness_state.get("last_transition_at")
            self._awareness_state["identity_conflict"] = conflict

            if conflict:
                self.status = IdentityRuntimeStatus.CONFLICT
                self._awareness_state["identity_confirmed"] = False
            elif validation_pending:
                self.status = IdentityRuntimeStatus.VALIDATING
                self._awareness_state["identity_confirmed"] = False
            elif mode in {IdentityMode.NOMINAL_IDENTIFICATION, IdentityMode.VERIFICATION} or (nominal_name and confidence >= 0.75):
                self.status = IdentityRuntimeStatus.IDENTIFIED
                self._awareness_state["identity_confirmed"] = True
            else:
                self.status = IdentityRuntimeStatus.TRACKING
                self._awareness_state["identity_confirmed"] = False

        self.sql_runtime_service.upsert_identity_entity(entity)
        self.sql_runtime_service.record_presence_event(
            session_key=self.runtime_key,
            entity_key=entity.entity_id,
            event_type="seen",
            source_key=entity.source_id,
            confidence=entity.confidence,
            payload={
                "mode": entity.mode.value,
                "validation_pending": validation_pending,
                "conflict": conflict,
                "speaker_id": speaker_id,
            },
        )
        self.sql_runtime_service.record_verification_event(
            session_key=self.runtime_key,
            entity_key=entity.entity_id,
            outcome=self.status.value,
            confidence=entity.confidence,
            payload={"nominal_name": entity.nominal_name, "mode": entity.mode.value},
        )

    def _persist_runtime_config(self) -> None:
        with self._lock:
            payload = {
                "runtime_key": self.runtime_key,
                "auto_start_enabled": self.auto_start_enabled,
                "runtime_enabled": self.runtime_enabled,
                "runtime_paused": self.runtime_paused,
                "selected_source_id": self.selected_source_id,
                "state": self.status.value,
                "metadata": {
                    "awareness_state": dict(self._awareness_state),
                    "tracked_entities_count": len(self._tracked_entities),
                    "last_error": self.last_error,
                },
            }
        self.sql_runtime_service.upsert_runtime_config(**payload)

    def _audit(self, event: str, payload: Dict[str, Any]) -> None:
        audit_log(
            component="identity_runtime",
            event=event,
            payload=dict(payload),
            trace_id=self.runtime_key,
        )
        self.sql_runtime_service.record_audit_log(event_name=event, payload=payload)

