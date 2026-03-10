"""
FILE: services/identity_runtime/face_detector.py
RESPONSIBILITY: Detect face bounding boxes from BGR frames.
FLOW ROLE: First CV layer before pose, quality and embedding checks.
READS: Decoded BGR frame.
RAM WRITES: Face detection results only.
PERSISTS: None.
PRIMARY RISK: Detector confidence drift can impact downstream quality and matching.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Dict, List, Optional

try:
    import cv2  # type: ignore
except Exception:  # noqa: BLE001
    cv2 = None  # type: ignore[assignment]

try:
    import mediapipe as mp  # type: ignore
except Exception:  # noqa: BLE001
    mp = None  # type: ignore[assignment]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


@dataclass
class FaceDetectionBox:
    x: int
    y: int
    w: int
    h: int
    confidence: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "x": int(self.x),
            "y": int(self.y),
            "w": int(self.w),
            "h": int(self.h),
            "confidence": float(_clamp(self.confidence, 0.0, 1.0)),
        }


@dataclass
class FaceDetector:
    min_confidence: float = 0.55
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _mp_detector: Any = field(default=None, init=False, repr=False)
    _haar_cascade: Any = field(default=None, init=False, repr=False)

    def detect_faces(self, frame_bgr, *, max_faces: int = 1) -> List[FaceDetectionBox]:
        max_faces = max(1, int(max_faces))
        rows = self._detect_with_mediapipe(frame_bgr, max_faces=max_faces)
        if rows:
            return rows[:max_faces]
        rows = self._detect_with_haar(frame_bgr, max_faces=max_faces)
        return rows[:max_faces]

    def _detect_with_mediapipe(self, frame_bgr, *, max_faces: int) -> List[FaceDetectionBox]:
        if (
            mp is None
            or cv2 is None
            or not hasattr(mp, "solutions")
            or not hasattr(mp.solutions, "face_detection")
        ):
            return []
        with self._lock:
            if self._mp_detector is None:
                try:
                    self._mp_detector = mp.solutions.face_detection.FaceDetection(
                        model_selection=0,
                        min_detection_confidence=float(_clamp(self.min_confidence, 0.05, 0.99)),
                    )
                except Exception:  # noqa: BLE001
                    self._mp_detector = False
            detector = self._mp_detector

        if not detector:
            return []

        try:
            rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            result = detector.process(rgb)
        except Exception:  # noqa: BLE001
            return []

        detections = getattr(result, "detections", None) or []
        if not detections:
            return []

        height, width = frame_bgr.shape[:2]
        boxes: List[FaceDetectionBox] = []
        for item in detections[:max_faces]:
            data = getattr(item, "location_data", None)
            rel = getattr(data, "relative_bounding_box", None) if data else None
            score = float(item.score[0]) if getattr(item, "score", None) else 0.0
            if rel is None:
                continue
            x = int(max(0, rel.xmin * width))
            y = int(max(0, rel.ymin * height))
            w = int(max(1, rel.width * width))
            h = int(max(1, rel.height * height))
            if w <= 2 or h <= 2:
                continue
            x = min(x, width - 1)
            y = min(y, height - 1)
            w = min(w, width - x)
            h = min(h, height - y)
            boxes.append(FaceDetectionBox(x=x, y=y, w=w, h=h, confidence=_clamp(score, 0.0, 1.0)))

        boxes.sort(key=lambda row: row.confidence, reverse=True)
        return boxes

    def _detect_with_haar(self, frame_bgr, *, max_faces: int) -> List[FaceDetectionBox]:
        if cv2 is None:
            return []
        with self._lock:
            if self._haar_cascade is None:
                try:
                    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                    self._haar_cascade = cv2.CascadeClassifier(cascade_path)
                except Exception:  # noqa: BLE001
                    self._haar_cascade = False
            cascade = self._haar_cascade

        if not cascade:
            return []
        try:
            gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
            found = cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(48, 48),
                flags=cv2.CASCADE_SCALE_IMAGE,
            )
        except Exception:  # noqa: BLE001
            return []

        boxes: List[FaceDetectionBox] = []
        for index, (x, y, w, h) in enumerate(found):
            if index >= max_faces:
                break
            boxes.append(FaceDetectionBox(x=int(x), y=int(y), w=int(w), h=int(h), confidence=0.55))
        boxes.sort(key=lambda row: row.w * row.h, reverse=True)
        return boxes

