"""
FILE: services/identity_runtime/passive_liveness_checker.py
RESPONSIBILITY: Estimate passive liveness from temporal motion cues.
FLOW ROLE: Layer-10 liveness without explicit user challenge.
READS: Per-track face box/pose timeline.
RAM WRITES: Short rolling history per track id.
PERSISTS: None.
PRIMARY RISK: Static-photo false positives in low-motion scenes.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from math import sqrt
from threading import RLock
from typing import Any, Deque, Dict, Optional, Tuple


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _face_center(face_box: Dict[str, Any]) -> Tuple[float, float]:
    x = float(face_box.get("x", 0))
    y = float(face_box.get("y", 0))
    w = max(1.0, float(face_box.get("w", 1)))
    h = max(1.0, float(face_box.get("h", 1)))
    return x + (w / 2.0), y + (h / 2.0)


@dataclass
class PassiveLivenessState:
    status: str
    confidence: float
    evidence: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "confidence": float(_clamp(self.confidence, 0.0, 1.0)),
            "evidence": dict(self.evidence),
        }


@dataclass
class PassiveLivenessChecker:
    min_motion_px: float = 1.1
    history_size: int = 16
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _history: Dict[str, Deque[Tuple[float, float, float, float]]] = field(default_factory=dict, init=False, repr=False)

    def update(
        self,
        *,
        track_id: str,
        face_box: Dict[str, Any],
        pose: Optional[Dict[str, Any]] = None,
    ) -> PassiveLivenessState:
        key = str(track_id or "").strip()
        if not key:
            return PassiveLivenessState(status="unknown", confidence=0.0, evidence={"reason": "missing_track_id"})

        cx, cy = _face_center(face_box)
        yaw = float((pose or {}).get("yaw", 0.0))
        pitch = float((pose or {}).get("pitch", 0.0))
        roll = float((pose or {}).get("roll", 0.0))

        with self._lock:
            queue = self._history.setdefault(key, deque(maxlen=max(4, int(self.history_size))))
            queue.append((cx, cy, yaw, pitch))
            rows = list(queue)

        if len(rows) < 3:
            return PassiveLivenessState(status="pending", confidence=0.35, evidence={"samples": len(rows)})

        motion_total = 0.0
        yaw_drift = 0.0
        pitch_drift = 0.0
        for index in range(1, len(rows)):
            px, py, pyaw, ppitch = rows[index - 1]
            nx, ny, nyaw, npitch = rows[index]
            motion_total += sqrt(((nx - px) ** 2) + ((ny - py) ** 2))
            yaw_drift += abs(nyaw - pyaw)
            pitch_drift += abs(npitch - ppitch)

        samples = max(1, len(rows) - 1)
        motion_avg = motion_total / samples
        yaw_avg = yaw_drift / samples
        pitch_avg = pitch_drift / samples

        motion_score = _clamp(motion_avg / 6.0, 0.0, 1.0)
        head_dynamics = _clamp((yaw_avg + pitch_avg) / 14.0, 0.0, 1.0)
        confidence = _clamp((0.62 * motion_score) + (0.38 * head_dynamics), 0.0, 1.0)

        if motion_avg < self.min_motion_px and head_dynamics < 0.18:
            status = "suspicious"
        elif confidence >= 0.55:
            status = "live"
        else:
            status = "pending"

        return PassiveLivenessState(
            status=status,
            confidence=confidence,
            evidence={
                "samples": len(rows),
                "motion_avg_px": round(motion_avg, 3),
                "yaw_drift_avg": round(yaw_avg, 3),
                "pitch_drift_avg": round(pitch_avg, 3),
                "roll_snapshot": round(roll, 3),
            },
        )

