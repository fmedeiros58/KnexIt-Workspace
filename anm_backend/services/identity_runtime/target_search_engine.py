"""
FILE: services/identity_runtime/target_search_engine.py
RESPONSIBILITY: Directed search against a preselected known target profile.
FLOW ROLE: Layer-8/9 target-mode matching across temporal track observations.
READS: Probe embeddings and target profile vectors.
RAM WRITES: Search sessions and track-level accumulators.
PERSISTS: None.
PRIMARY RISK: Incomplete target profiles may delay confirmations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Dict, List, Optional, Sequence
from uuid import uuid4

from anm_backend.services.identity_runtime.types import utc_now_iso
from anm_backend.services.identity_runtime.vector_matcher import VectorMatcher


def _normalize(value: Any) -> str:
    return str(value or "").strip()


@dataclass
class TargetSearchSession:
    session_id: str
    target_person_id: str
    status: str
    started_at: str
    ended_at: Optional[str] = None
    threshold: float = 0.74
    metadata: Dict[str, Any] = field(default_factory=dict)
    track_state: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "target_person_id": self.target_person_id,
            "status": self.status,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "threshold": self.threshold,
            "metadata": dict(self.metadata),
            "track_state": {key: dict(value) for key, value in self.track_state.items()},
        }


@dataclass
class TargetSearchEngine:
    matcher: VectorMatcher = field(default_factory=VectorMatcher)
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _sessions: Dict[str, TargetSearchSession] = field(default_factory=dict, init=False, repr=False)
    _profiles: Dict[str, Dict[str, List[Sequence[float]]]] = field(default_factory=dict, init=False, repr=False)

    def register_target_profile(self, *, person_id: str, vectors_by_view: Dict[str, List[Sequence[float]]]) -> None:
        key = _normalize(person_id)
        if not key:
            return
        clean: Dict[str, List[Sequence[float]]] = {}
        for view_key, rows in (vectors_by_view or {}).items():
            normalized_view = str(view_key or "").strip().lower() or "unknown"
            clean[normalized_view] = [list(vector) for vector in (rows or []) if vector]
        with self._lock:
            self._profiles[key] = clean

    def start_search(self, *, target_person_id: str, threshold: Optional[float] = None, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        target = _normalize(target_person_id)
        if not target:
            raise ValueError("target_person_id_required")
        with self._lock:
            if target not in self._profiles:
                raise ValueError("target_profile_not_registered")
            session = TargetSearchSession(
                session_id=f"srch-{uuid4().hex}",
                target_person_id=target,
                status="active",
                started_at=utc_now_iso(),
                threshold=float(threshold if threshold is not None else self.matcher.default_threshold),
                metadata=dict(metadata or {}),
            )
            self._sessions[session.session_id] = session
            return session.to_dict()

    def stop_search(self, *, session_id: str) -> Optional[Dict[str, Any]]:
        key = _normalize(session_id)
        if not key:
            return None
        with self._lock:
            session = self._sessions.get(key)
            if not session:
                return None
            session.status = "stopped"
            session.ended_at = utc_now_iso()
            return session.to_dict()

    def evaluate_probe(
        self,
        *,
        session_id: str,
        track_id: str,
        probe_embedding: Sequence[float],
        view: str = "unknown",
    ) -> Optional[Dict[str, Any]]:
        key = _normalize(session_id)
        track_key = _normalize(track_id) or "track-unknown"
        if not key:
            return None
        with self._lock:
            session = self._sessions.get(key)
            if not session or session.status != "active":
                return None
            profile = self._profiles.get(session.target_person_id, {})
        candidates = {session.target_person_id: profile.get(str(view).strip().lower(), []) or profile.get("unknown", [])}
        if not candidates[session.target_person_id]:
            # Fallback to all vectors across views.
            aggregate_rows: List[Sequence[float]] = []
            for rows in profile.values():
                aggregate_rows.extend(rows)
            candidates[session.target_person_id] = aggregate_rows
        ranked = self.matcher.rank_candidates(probe_embedding=probe_embedding, candidates=candidates, view=view, limit=1)
        best = ranked[0] if ranked else None
        similarity = float(best.similarity) if best else 0.0

        with self._lock:
            session = self._sessions.get(key)
            if not session:
                return None
            state = session.track_state.get(track_key, {"samples": 0, "similarity_avg": 0.0, "last_similarity": 0.0, "status": "pending"})
            samples = int(state.get("samples", 0)) + 1
            avg = ((float(state.get("similarity_avg", 0.0)) * (samples - 1)) + similarity) / max(1, samples)
            status = "target_confirmed" if avg >= session.threshold and samples >= 3 else "candidate_in_validation"
            state.update(
                {
                    "samples": samples,
                    "similarity_avg": avg,
                    "last_similarity": similarity,
                    "status": status,
                    "updated_at": utc_now_iso(),
                    "view": str(view or "unknown"),
                }
            )
            session.track_state[track_key] = state
            result = {
                "session_id": session.session_id,
                "target_person_id": session.target_person_id,
                "track_id": track_key,
                "similarity": similarity,
                "similarity_avg": avg,
                "threshold": session.threshold,
                "samples": samples,
                "status": status,
            }
            return result

    def get_session(self, *, session_id: str) -> Optional[Dict[str, Any]]:
        key = _normalize(session_id)
        if not key:
            return None
        with self._lock:
            session = self._sessions.get(key)
            return session.to_dict() if session else None

