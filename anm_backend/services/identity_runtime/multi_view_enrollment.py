"""
FILE: services/identity_runtime/multi_view_enrollment.py
RESPONSIBILITY: Manage multi-view enrollment sessions and profile consolidation.
FLOW ROLE: Layer-6 enrollment for left/front/right references and centroids.
READS: Approved samples and embeddings per capture view.
RAM WRITES: In-memory enrollment sessions/profiles.
PERSISTS: Optional via external storage (not handled here).
PRIMARY RISK: Low-quality samples can skew pose centroids.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Dict, List, Optional, Sequence
from uuid import uuid4

try:
    import numpy as np  # type: ignore
except Exception:  # noqa: BLE001
    np = None  # type: ignore[assignment]

from anm_backend.services.identity_runtime.types import utc_now_iso


def _normalize(value: Any) -> str:
    return str(value or "").strip()


def _normalize_view(value: Any) -> str:
    key = _normalize(value).lower()
    if key in {"left", "lateral-left", "left-profile", "channel-2", "environment-left"}:
        return "left"
    if key in {"front", "frontal", "main", "center", "channel-3", "environment-front"}:
        return "front"
    if key in {"right", "lateral-right", "right-profile", "channel-4", "environment-right"}:
        return "right"
    return "unknown"


def _mean_vector(rows: List[Sequence[float]]) -> Optional[List[float]]:
    if np is None or not rows:
        return None
    vectors = [np.asarray(list(item), dtype="float32") for item in rows if item]
    if not vectors:
        return None
    min_dim = min(int(item.shape[0]) for item in vectors if item.ndim == 1)
    if min_dim <= 0:
        return None
    stacked = np.stack([item[:min_dim] for item in vectors], axis=0)
    centroid = stacked.mean(axis=0)
    return centroid.astype("float32").tolist()


@dataclass
class EnrollmentSession:
    session_id: str
    person_id: str
    required_views: List[str]
    min_samples_per_view: int
    started_at: str
    status: str = "active"
    samples: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "person_id": self.person_id,
            "required_views": list(self.required_views),
            "min_samples_per_view": int(self.min_samples_per_view),
            "started_at": self.started_at,
            "status": self.status,
            "samples": {key: list(value) for key, value in self.samples.items()},
            "progress": {
                view: {
                    "count": len(self.samples.get(view, [])),
                    "required": self.min_samples_per_view,
                    "ready": len(self.samples.get(view, [])) >= self.min_samples_per_view,
                }
                for view in self.required_views
            },
        }


@dataclass
class MultiViewEnrollment:
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _sessions: Dict[str, EnrollmentSession] = field(default_factory=dict, init=False, repr=False)
    _profiles: Dict[str, Dict[str, Any]] = field(default_factory=dict, init=False, repr=False)

    def start_session(
        self,
        *,
        person_id: str,
        required_views: Optional[List[str]] = None,
        min_samples_per_view: int = 3,
    ) -> Dict[str, Any]:
        clean_person = _normalize(person_id) or f"person-{uuid4().hex[:8]}"
        views = [_normalize_view(item) for item in (required_views or ["left", "front", "right"])]
        views = [item for item in views if item in {"left", "front", "right"}]
        if not views:
            views = ["left", "front", "right"]
        session = EnrollmentSession(
            session_id=f"enr-{uuid4().hex}",
            person_id=clean_person,
            required_views=views,
            min_samples_per_view=max(1, int(min_samples_per_view)),
            started_at=utc_now_iso(),
            samples={view: [] for view in views},
        )
        with self._lock:
            self._sessions[session.session_id] = session
        return session.to_dict()

    def submit_sample(
        self,
        *,
        session_id: str,
        view: str,
        embedding: Optional[Sequence[float]],
        quality_score: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        key = _normalize(session_id)
        if not key:
            return None
        clean_view = _normalize_view(view)
        if clean_view not in {"left", "front", "right"}:
            return None
        with self._lock:
            session = self._sessions.get(key)
            if not session or session.status != "active":
                return None
            if clean_view not in session.samples:
                session.samples[clean_view] = []
            session.samples[clean_view].append(
                {
                    "view": clean_view,
                    "embedding": list(embedding) if embedding is not None else None,
                    "quality_score": float(max(0.0, min(1.0, quality_score))),
                    "metadata": dict(metadata or {}),
                    "created_at": utc_now_iso(),
                }
            )
            session_dict = session.to_dict()

        self._refresh_profile(person_id=session_dict["person_id"])
        return session_dict

    def close_session(self, *, session_id: str) -> Optional[Dict[str, Any]]:
        key = _normalize(session_id)
        if not key:
            return None
        with self._lock:
            session = self._sessions.get(key)
            if not session:
                return None
            session.status = "completed"
            session_dict = session.to_dict()
        self._refresh_profile(person_id=session.person_id)
        return session_dict

    def get_profile(self, *, person_id: str) -> Optional[Dict[str, Any]]:
        key = _normalize(person_id)
        if not key:
            return None
        with self._lock:
            profile = self._profiles.get(key)
            return dict(profile) if profile else None

    def get_session(self, *, session_id: str) -> Optional[Dict[str, Any]]:
        key = _normalize(session_id)
        if not key:
            return None
        with self._lock:
            session = self._sessions.get(key)
            return session.to_dict() if session else None

    def _refresh_profile(self, *, person_id: str) -> None:
        key = _normalize(person_id)
        if not key:
            return
        rows: List[Dict[str, Any]] = []
        with self._lock:
            for session in self._sessions.values():
                if session.person_id != key:
                    continue
                for view_rows in session.samples.values():
                    rows.extend(view_rows)

        by_view: Dict[str, List[Sequence[float]]] = {"left": [], "front": [], "right": []}
        sample_count = {"left": 0, "front": 0, "right": 0}
        for row in rows:
            view = _normalize_view(row.get("view"))
            embedding = row.get("embedding")
            if view not in by_view:
                continue
            sample_count[view] += 1
            if isinstance(embedding, list) and embedding:
                by_view[view].append(embedding)

        left_centroid = _mean_vector(by_view["left"])
        front_centroid = _mean_vector(by_view["front"])
        right_centroid = _mean_vector(by_view["right"])
        # Consolidated centroid over centroids with equal weight when available.
        centroid_rows = [item for item in [left_centroid, front_centroid, right_centroid] if item]
        consolidated = _mean_vector(centroid_rows)

        profile = {
            "person_id": key,
            "left_centroid": left_centroid,
            "front_centroid": front_centroid,
            "right_centroid": right_centroid,
            "consolidated_centroid": consolidated,
            "sample_count": sample_count,
            "updated_at": utc_now_iso(),
        }
        with self._lock:
            self._profiles[key] = profile
