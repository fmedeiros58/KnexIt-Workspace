"""
FILE: services/identity_runtime/frame_quality_gate.py
RESPONSIBILITY: Score frame quality before embedding/matching stages.
FLOW ROLE: Layer-4 quality gate to reject poor captures early.
READS: BGR frame and selected face bounding box.
RAM WRITES: Short in-memory motion baseline per track key.
PERSISTS: None.
PRIMARY RISK: Aggressive thresholds can reduce capture recall.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Dict, List, Optional, Tuple

try:
    import cv2  # type: ignore
except Exception:  # noqa: BLE001
    cv2 = None  # type: ignore[assignment]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


@dataclass
class FrameQualityResult:
    blur_score: float
    lighting_score: float
    framing_score: float
    stability_score: float
    overall_score: float
    approved: bool
    reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "blur_score": float(_clamp(self.blur_score, 0.0, 1.0)),
            "lighting_score": float(_clamp(self.lighting_score, 0.0, 1.0)),
            "framing_score": float(_clamp(self.framing_score, 0.0, 1.0)),
            "stability_score": float(_clamp(self.stability_score, 0.0, 1.0)),
            "overall_score": float(_clamp(self.overall_score, 0.0, 1.0)),
            "approved": bool(self.approved),
            "reasons": list(self.reasons),
        }


@dataclass
class FrameQualityGate:
    min_blur_score: float = 0.22
    min_lighting_score: float = 0.25
    min_framing_score: float = 0.30
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _last_face_by_track: Dict[str, Tuple[float, float, float, float]] = field(default_factory=dict, init=False, repr=False)

    def evaluate(
        self,
        frame_bgr,
        face_box: Optional[Dict[str, Any]],
        *,
        track_key: str = "",
        min_overall_score: float = 0.55,
    ) -> FrameQualityResult:
        if frame_bgr is None or getattr(frame_bgr, "size", 0) <= 0:
            return FrameQualityResult(
                blur_score=0.0,
                lighting_score=0.0,
                framing_score=0.0,
                stability_score=0.0,
                overall_score=0.0,
                approved=False,
                reasons=["invalid_frame"],
            )
        if cv2 is None:
            return FrameQualityResult(
                blur_score=0.0,
                lighting_score=0.0,
                framing_score=0.0,
                stability_score=0.0,
                overall_score=0.0,
                approved=False,
                reasons=["opencv_unavailable"],
            )
        if not face_box:
            return FrameQualityResult(
                blur_score=0.0,
                lighting_score=0.0,
                framing_score=0.0,
                stability_score=0.0,
                overall_score=0.0,
                approved=False,
                reasons=["face_not_detected"],
            )

        height, width = frame_bgr.shape[:2]
        x = int(max(0, min(width - 1, face_box.get("x", 0))))
        y = int(max(0, min(height - 1, face_box.get("y", 0))))
        w = int(max(1, min(width - x, face_box.get("w", 1))))
        h = int(max(1, min(height - y, face_box.get("h", 1))))

        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        blur_value = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        blur_score = _clamp((blur_value - 45.0) / 320.0, 0.0, 1.0)

        mean_luma = float(gray.mean())
        lighting_score = _clamp(1.0 - abs(mean_luma - 128.0) / 96.0, 0.0, 1.0)

        area_ratio = float((w * h) / max(1, width * height))
        size_score = _clamp((area_ratio - 0.012) / 0.12, 0.0, 1.0)
        cx = x + w / 2.0
        cy = y + h / 2.0
        center_dx = abs(cx - width / 2.0) / max(1.0, width / 2.0)
        center_dy = abs(cy - height / 2.0) / max(1.0, height / 2.0)
        center_score = _clamp(1.0 - ((center_dx + center_dy) / 2.0), 0.0, 1.0)
        framing_score = _clamp((0.62 * size_score) + (0.38 * center_score), 0.0, 1.0)

        stability_score = self._compute_stability(track_key=track_key.strip(), box=(cx, cy, float(w), float(h)))

        overall = _clamp(
            (0.30 * blur_score) + (0.24 * lighting_score) + (0.26 * framing_score) + (0.20 * stability_score),
            0.0,
            1.0,
        )

        reasons: List[str] = []
        if blur_score < self.min_blur_score:
            reasons.append("blur_too_high")
        if lighting_score < self.min_lighting_score:
            reasons.append("lighting_insufficient")
        if framing_score < self.min_framing_score:
            reasons.append("framing_invalid")
        if stability_score < 0.20:
            reasons.append("instability_high")
        if overall < float(min_overall_score):
            reasons.append("overall_quality_below_threshold")

        approved = not reasons
        return FrameQualityResult(
            blur_score=blur_score,
            lighting_score=lighting_score,
            framing_score=framing_score,
            stability_score=stability_score,
            overall_score=overall,
            approved=approved,
            reasons=reasons,
        )

    def _compute_stability(self, *, track_key: str, box: Tuple[float, float, float, float]) -> float:
        cx, cy, w, h = box
        if not track_key:
            return 0.65

        with self._lock:
            previous = self._last_face_by_track.get(track_key)
            self._last_face_by_track[track_key] = box

        if previous is None:
            return 0.70

        pcx, pcy, pw, ph = previous
        dx = abs(cx - pcx) / max(1.0, (w + pw) / 2.0)
        dy = abs(cy - pcy) / max(1.0, (h + ph) / 2.0)
        motion = (dx + dy) / 2.0
        scale_change = abs((w * h) - (pw * ph)) / max(1.0, pw * ph)
        score = 1.0 - min(1.0, (0.75 * motion) + (0.45 * scale_change))
        return _clamp(score, 0.0, 1.0)

