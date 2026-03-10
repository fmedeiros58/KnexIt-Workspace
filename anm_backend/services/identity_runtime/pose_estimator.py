"""
FILE: services/identity_runtime/pose_estimator.py
RESPONSIBILITY: Estimate head pose (yaw/pitch/roll) and classify facial view.
FLOW ROLE: Layer-3 validation for pose-aware capture and matching.
READS: Decoded BGR frame.
RAM WRITES: Pose estimation result only.
PERSISTS: None.
PRIMARY RISK: Euler conversion noise can flip side labels near threshold.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Dict, Optional

try:
    import cv2  # type: ignore
except Exception:  # noqa: BLE001
    cv2 = None  # type: ignore[assignment]

try:
    import mediapipe as mp  # type: ignore
except Exception:  # noqa: BLE001
    mp = None  # type: ignore[assignment]

try:
    import numpy as np  # type: ignore
except Exception:  # noqa: BLE001
    np = None  # type: ignore[assignment]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _normalize(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_view(value: str) -> Optional[str]:
    key = _normalize(value)
    if not key:
        return None
    if key in {"front", "frontal", "main", "center", "canal-3", "channel-3"}:
        return "front"
    if key in {"left", "lateral_left", "left-profile", "canal-2", "channel-2"}:
        return "left"
    if key in {"right", "lateral_right", "right-profile", "canal-4", "channel-4"}:
        return "right"
    return key


@dataclass
class PoseEstimate:
    pose_label: str
    yaw: float
    pitch: float
    roll: float
    confidence: float
    pose_match: bool
    expected_view: Optional[str] = None
    landmarks_detected: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pose_label": self.pose_label,
            "yaw": float(self.yaw),
            "pitch": float(self.pitch),
            "roll": float(self.roll),
            "confidence": float(_clamp(self.confidence, 0.0, 1.0)),
            "pose_match": bool(self.pose_match),
            "expected_view": self.expected_view,
            "landmarks_detected": bool(self.landmarks_detected),
        }


@dataclass
class PoseEstimator:
    side_yaw_threshold: float = 17.0
    front_yaw_tolerance: float = 15.0
    pitch_tolerance: float = 22.0
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _face_mesh: Any = field(default=None, init=False, repr=False)

    def estimate_pose(self, frame_bgr, *, expected_view: Optional[str] = None) -> PoseEstimate:
        normalized_expected = _normalize_view(expected_view or "")
        if mp is None or cv2 is None or np is None:
            return PoseEstimate(
                pose_label="unknown",
                yaw=0.0,
                pitch=0.0,
                roll=0.0,
                confidence=0.0,
                pose_match=False if normalized_expected else True,
                expected_view=normalized_expected,
                landmarks_detected=False,
            )

        with self._lock:
            if self._face_mesh is None:
                self._face_mesh = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=True,
                    max_num_faces=1,
                    refine_landmarks=False,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
            mesh = self._face_mesh

        try:
            rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            result = mesh.process(rgb)
        except Exception:  # noqa: BLE001
            return PoseEstimate(
                pose_label="unknown",
                yaw=0.0,
                pitch=0.0,
                roll=0.0,
                confidence=0.0,
                pose_match=False if normalized_expected else True,
                expected_view=normalized_expected,
                landmarks_detected=False,
            )

        points = getattr(result, "multi_face_landmarks", None) or []
        if not points:
            return PoseEstimate(
                pose_label="unknown",
                yaw=0.0,
                pitch=0.0,
                roll=0.0,
                confidence=0.0,
                pose_match=False if normalized_expected else True,
                expected_view=normalized_expected,
                landmarks_detected=False,
            )

        landmarks = points[0].landmark
        image_h, image_w = frame_bgr.shape[:2]

        # Canonical 2D image points from FaceMesh indices.
        idx = {
            "nose_tip": 1,
            "chin": 152,
            "left_eye_corner": 33,
            "right_eye_corner": 263,
            "left_mouth": 61,
            "right_mouth": 291,
        }
        image_points = np.array(
            [
                [landmarks[idx["nose_tip"]].x * image_w, landmarks[idx["nose_tip"]].y * image_h],
                [landmarks[idx["chin"]].x * image_w, landmarks[idx["chin"]].y * image_h],
                [landmarks[idx["left_eye_corner"]].x * image_w, landmarks[idx["left_eye_corner"]].y * image_h],
                [landmarks[idx["right_eye_corner"]].x * image_w, landmarks[idx["right_eye_corner"]].y * image_h],
                [landmarks[idx["left_mouth"]].x * image_w, landmarks[idx["left_mouth"]].y * image_h],
                [landmarks[idx["right_mouth"]].x * image_w, landmarks[idx["right_mouth"]].y * image_h],
            ],
            dtype="double",
        )

        model_points = np.array(
            [
                (0.0, 0.0, 0.0),  # nose
                (0.0, -63.6, -12.5),  # chin
                (-43.3, 32.7, -26.0),  # left eye corner
                (43.3, 32.7, -26.0),  # right eye corner
                (-28.9, -28.9, -24.1),  # left mouth
                (28.9, -28.9, -24.1),  # right mouth
            ],
            dtype="double",
        )

        focal_length = float(image_w)
        center = (image_w / 2.0, image_h / 2.0)
        camera_matrix = np.array(
            [[focal_length, 0, center[0]], [0, focal_length, center[1]], [0, 0, 1]],
            dtype="double",
        )
        dist_coeffs = np.zeros((4, 1))

        success, rotation_vector, _translation_vector = cv2.solvePnP(
            model_points,
            image_points,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not bool(success):
            return PoseEstimate(
                pose_label="unknown",
                yaw=0.0,
                pitch=0.0,
                roll=0.0,
                confidence=0.0,
                pose_match=False if normalized_expected else True,
                expected_view=normalized_expected,
                landmarks_detected=True,
            )

        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
        rq = cv2.RQDecomp3x3(rotation_matrix)
        angles = rq[0] if isinstance(rq, tuple) and rq else (0.0, 0.0, 0.0)
        pitch = float(angles[0])
        yaw = float(angles[1])
        roll = float(angles[2])

        if abs(yaw) <= self.front_yaw_tolerance and abs(pitch) <= self.pitch_tolerance:
            pose_label = "front"
        elif yaw <= -self.side_yaw_threshold:
            pose_label = "left"
        elif yaw >= self.side_yaw_threshold:
            pose_label = "right"
        else:
            pose_label = "unknown"

        pose_match = True
        if normalized_expected in {"front", "left", "right"}:
            pose_match = pose_label == normalized_expected

        # Penalize excessive vertical tilt and roll.
        pitch_penalty = min(abs(pitch) / 45.0, 1.0)
        roll_penalty = min(abs(roll) / 45.0, 1.0)
        confidence = 1.0 - (0.55 * pitch_penalty + 0.45 * roll_penalty)
        if pose_label == "unknown":
            confidence *= 0.55
        confidence = _clamp(confidence, 0.0, 1.0)

        return PoseEstimate(
            pose_label=pose_label,
            yaw=yaw,
            pitch=pitch,
            roll=roll,
            confidence=confidence,
            pose_match=pose_match,
            expected_view=normalized_expected,
            landmarks_detected=True,
        )

