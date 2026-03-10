"""
FILE: services/identity_runtime/face_normalizer.py
RESPONSIBILITY: Normalize aligned face crop for embedding-ready tensors.
FLOW ROLE: Layer-5 normalization contract between aligner and embedders.
READS: Aligned face BGR crop.
RAM WRITES: Normalized arrays only.
PERSISTS: None.
PRIMARY RISK: Inconsistent normalization parameters across embedders.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

try:
    import cv2  # type: ignore
except Exception:  # noqa: BLE001
    cv2 = None  # type: ignore[assignment]

try:
    import numpy as np  # type: ignore
except Exception:  # noqa: BLE001
    np = None  # type: ignore[assignment]


@dataclass
class FaceNormalizer:
    output_width: int = 160
    output_height: int = 160

    def normalize(self, face_bgr) -> Optional[Dict[str, Any]]:
        if face_bgr is None or getattr(face_bgr, "size", 0) <= 0:
            return None
        if cv2 is None or np is None:
            return None

        resized = cv2.resize(face_bgr, (int(self.output_width), int(self.output_height)), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        normalized = (rgb.astype("float32") - 127.5) / 128.0
        mean_luma = float(cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY).mean())
        return {
            "image_bgr": resized,
            "image_rgb": rgb,
            "tensor": normalized,
            "shape": [int(self.output_height), int(self.output_width), 3],
            "mean_luma": mean_luma,
        }

