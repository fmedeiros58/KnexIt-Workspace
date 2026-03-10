"""
FILE: services/identity_runtime/frame_codec.py
RESPONSIBILITY: Decode inbound frame payloads to OpenCV images.
FLOW ROLE: Normalize data URL/base64 payload into BGR ndarray for CV pipeline.
READS: Base64 frame payload provided by API callers.
RAM WRITES: Decoded frame matrix.
PERSISTS: None.
PRIMARY RISK: Invalid payloads can trigger decode errors or oversize memory usage.
"""

from __future__ import annotations

import base64
from typing import Any

try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
except Exception:  # noqa: BLE001
    cv2 = None  # type: ignore[assignment]
    np = None  # type: ignore[assignment]


def _normalize(value: Any) -> str:
    return str(value or "").strip()


def decode_frame_data_url(payload: str, *, max_bytes: int = 12 * 1024 * 1024):
    """
    Decode data URL or raw base64 payload into BGR frame.
    Raises ValueError on payload errors and RuntimeError when OpenCV/Numpy are unavailable.
    """
    if cv2 is None or np is None:
        raise RuntimeError("opencv_or_numpy_unavailable")

    raw = _normalize(payload)
    if not raw:
        raise ValueError("empty_frame_payload")

    if raw.startswith("data:"):
        comma_index = raw.find(",")
        if comma_index < 0:
            raise ValueError("invalid_data_url_frame_payload")
        raw = raw[comma_index + 1 :]

    try:
        decoded = base64.b64decode(raw, validate=False)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("invalid_base64_frame_payload") from exc

    if not decoded:
        raise ValueError("empty_decoded_frame_payload")
    if len(decoded) > int(max_bytes):
        raise ValueError("frame_payload_too_large")

    buffer = np.frombuffer(decoded, dtype=np.uint8)
    frame = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if frame is None or frame.size <= 0:
        raise ValueError("invalid_frame_image_payload")
    return frame

