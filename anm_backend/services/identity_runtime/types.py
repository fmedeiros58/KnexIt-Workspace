"""
FILE: services/identity_runtime/types.py
RESPONSIBILITY: Shared data contracts for identity runtime domain.
FLOW ROLE: Typed state exchange between bootstrap, runtime, stream manager and API routes.
READS: In-memory runtime state.
RAM WRITES: Dataclass instances only.
PERSISTS: None directly.
PRIMARY RISK: Contract drift across modules.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class IdentityRuntimeStatus(str, Enum):
    DISABLED = "disabled"
    ENABLED_IDLE = "enabled_idle"
    MONITORING = "monitoring"
    TRACKING = "tracking"
    VALIDATING = "validating"
    IDENTIFIED = "identified"
    CONFLICT = "conflict"
    PAUSED = "paused"
    DEGRADED = "degraded"


class IdentityMode(str, Enum):
    DETECTION = "detection"
    TRACKING = "tracking"
    REIDENTIFICATION = "reidentification"
    VERIFICATION = "verification"
    NOMINAL_IDENTIFICATION = "nominal_identification"


@dataclass
class CameraSource:
    source_id: str
    name: str
    source_type: str
    device_ref: str = ""
    resolution: str = "1280x720"
    fps: int = 30
    priority: int = 100
    active: bool = True
    connected: bool = True
    last_heartbeat_at: str = field(default_factory=utc_now_iso)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CameraStreamSession:
    stream_id: str
    source_id: str
    status: str
    started_at: str = field(default_factory=utc_now_iso)
    ended_at: Optional[str] = None
    fps_observed: float = 0.0
    latency_ms: int = 0
    dropped_frames: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class IdentityEntity:
    entity_id: str
    label: str
    mode: IdentityMode = IdentityMode.DETECTION
    confidence: float = 0.0
    source_id: Optional[str] = None
    voice_profile_id: Optional[str] = None
    nominal_name: Optional[str] = None
    first_seen_at: str = field(default_factory=utc_now_iso)
    last_seen_at: str = field(default_factory=utc_now_iso)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["mode"] = self.mode.value
        return payload


@dataclass
class IdentityRuntimeSnapshot:
    status: IdentityRuntimeStatus
    runtime_enabled: bool
    runtime_paused: bool
    auto_start_enabled: bool
    selected_source_id: Optional[str]
    active_streams: List[CameraStreamSession]
    camera_sources: List[CameraSource]
    tracked_entities: List[IdentityEntity]
    current_identity: Optional[IdentityEntity]
    awareness_state: Dict[str, Any]
    self_model_state: Dict[str, Any]
    user_pattern_state: Dict[str, Any]
    last_error: str = ""
    updated_at: str = field(default_factory=utc_now_iso)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status.value,
            "runtime_enabled": self.runtime_enabled,
            "runtime_paused": self.runtime_paused,
            "auto_start_enabled": self.auto_start_enabled,
            "selected_source_id": self.selected_source_id,
            "active_streams": [item.to_dict() for item in self.active_streams],
            "camera_sources": [item.to_dict() for item in self.camera_sources],
            "tracked_entities": [item.to_dict() for item in self.tracked_entities],
            "current_identity": self.current_identity.to_dict() if self.current_identity else None,
            "awareness_state": dict(self.awareness_state),
            "self_model_state": dict(self.self_model_state),
            "user_pattern_state": dict(self.user_pattern_state),
            "last_error": self.last_error,
            "updated_at": self.updated_at,
        }

