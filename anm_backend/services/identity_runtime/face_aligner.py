"""
FILE: services/identity_runtime/face_aligner.py
RESPONSIBILITY: Align face crop before normalization/embedding.
FLOW ROLE: Layer-5 geometric stabilization of face ROI.
READS: Source frame, detection box, optional pose estimate.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Over-rotation on noisy roll can reduce quality.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

try:
    import cv2  # type: ignore
except Exception:  # noqa: BLE001
    cv2 = None  # type: ignore[assignment]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


@dataclass
class FaceAligner:
    margin_ratio: float = 0.16
    max_roll_degrees: float = 22.0

    def align(
        self,
        frame_bgr,
        *,
        face_box: Dict[str, Any],
        pose: Optional[Dict[str, Any]] = None,
    ):
        if frame_bgr is None or getattr(frame_bgr, "size", 0) <= 0:
            return None
        if cv2 is None:
            return None

        height, width = frame_bgr.shape[:2]
        x = float(face_box.get("x", 0))
        y = float(face_box.get("y", 0))
        w = max(1.0, float(face_box.get("w", 1)))
        h = max(1.0, float(face_box.get("h", 1)))
        margin = max(2.0, min(w, h) * float(self.margin_ratio))

        x1 = int(max(0, x - margin))
        y1 = int(max(0, y - margin))
        x2 = int(min(width, x + w + margin))
        y2 = int(min(height, y + h + margin))
        if x2 <= x1 or y2 <= y1:
            return None

        roi = frame_bgr[y1:y2, x1:x2]
        if roi is None or getattr(roi, "size", 0) <= 0:
            return None

        roll = 0.0
        if pose and isinstance(pose, dict):
            roll = float(pose.get("roll", 0.0))
        roll = float(_clamp(roll, -self.max_roll_degrees, self.max_roll_degrees))
        if abs(roll) < 1.2:
            return roi

        center = (roi.shape[1] / 2.0, roi.shape[0] / 2.0)
        matrix = cv2.getRotationMatrix2D(center, -roll, 1.0)
        aligned = cv2.warpAffine(
            roi,
            matrix,
            (roi.shape[1], roi.shape[0]),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REPLICATE,
        )
        return aligned

