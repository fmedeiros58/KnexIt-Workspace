"""
FILE: services/identity_runtime/active_liveness_checker.py
RESPONSIBILITY: Manage active liveness challenges and validation state.
FLOW ROLE: Layer-11 challenge-response liveness verification.
READS: Pose observations from runtime stream.
RAM WRITES: In-memory challenge sessions.
PERSISTS: None.
PRIMARY RISK: Loose pose thresholds can be gamed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Dict, List, Optional
from uuid import uuid4

from anm_backend.services.identity_runtime.types import utc_now_iso


def _normalize(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_action(value: str) -> str:
    key = _normalize(value)
    if key in {"look_front", "front", "frontal"}:
        return "look_front"
    if key in {"look_left", "left"}:
        return "look_left"
    if key in {"look_right", "right"}:
        return "look_right"
    if key in {"hold_still", "still"}:
        return "hold_still"
    return key or "look_front"


@dataclass
class ActiveLivenessChallenge:
    challenge_id: str
    track_id: str
    actions: List[str]
    current_index: int
    status: str
    started_at: str
    updated_at: str
    expires_at: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "challenge_id": self.challenge_id,
            "track_id": self.track_id,
            "actions": list(self.actions),
            "current_index": int(self.current_index),
            "current_action": self.actions[self.current_index] if self.current_index < len(self.actions) else None,
            "status": self.status,
            "started_at": self.started_at,
            "updated_at": self.updated_at,
            "expires_at": self.expires_at,
            "metadata": dict(self.metadata),
        }


@dataclass
class ActiveLivenessChecker:
    default_actions: List[str] = field(default_factory=lambda: ["look_front", "look_left", "look_right"])
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _challenges: Dict[str, ActiveLivenessChallenge] = field(default_factory=dict, init=False, repr=False)

    def start_challenge(self, *, track_id: str, actions: Optional[List[str]] = None) -> ActiveLivenessChallenge:
        clean_track = str(track_id or "").strip()
        if not clean_track:
            clean_track = f"track-{uuid4().hex[:8]}"
        normalized_actions = [_normalize_action(item) for item in (actions or self.default_actions) if _normalize_action(item)]
        if not normalized_actions:
            normalized_actions = ["look_front"]
        now_iso = utc_now_iso()
        challenge = ActiveLivenessChallenge(
            challenge_id=f"chl-{uuid4().hex}",
            track_id=clean_track,
            actions=normalized_actions,
            current_index=0,
            status="pending",
            started_at=now_iso,
            updated_at=now_iso,
        )
        with self._lock:
            self._challenges[challenge.challenge_id] = challenge
        return challenge

    def update_observation(
        self,
        *,
        challenge_id: str,
        pose_label: str,
        pose: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        key = str(challenge_id or "").strip()
        if not key:
            return None
        with self._lock:
            challenge = self._challenges.get(key)
            if not challenge:
                return None
            if challenge.status in {"passed", "failed", "expired"}:
                return challenge.to_dict()

            expected = challenge.actions[challenge.current_index] if challenge.current_index < len(challenge.actions) else None
            current_pose = _normalize(pose_label)

            matched = self._match_action(expected=expected, pose_label=current_pose, pose=pose or {})
            if matched:
                challenge.current_index += 1
                challenge.updated_at = utc_now_iso()
                if challenge.current_index >= len(challenge.actions):
                    challenge.status = "passed"
                else:
                    challenge.status = "in_progress"
            else:
                challenge.status = "pending"
                challenge.updated_at = utc_now_iso()

            return challenge.to_dict()

    def get_challenge(self, challenge_id: str) -> Optional[Dict[str, Any]]:
        key = str(challenge_id or "").strip()
        if not key:
            return None
        with self._lock:
            challenge = self._challenges.get(key)
            return challenge.to_dict() if challenge else None

    def _match_action(self, *, expected: Optional[str], pose_label: str, pose: Dict[str, Any]) -> bool:
        action = _normalize_action(expected or "")
        if action == "look_front":
            return pose_label == "front"
        if action == "look_left":
            return pose_label == "left"
        if action == "look_right":
            return pose_label == "right"
        if action == "hold_still":
            yaw = abs(float(pose.get("yaw", 0.0)))
            pitch = abs(float(pose.get("pitch", 0.0)))
            return yaw <= 6.0 and pitch <= 6.0
        return pose_label == "front"

