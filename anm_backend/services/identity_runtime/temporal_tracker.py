"""
FILE: services/identity_runtime/temporal_tracker.py
RESPONSIBILITY: Assign stable track ids to face detections across frames.
FLOW ROLE: Layer-9 temporal continuity for multi-face runtime analysis.
READS: Source id and face bounding boxes from detector layer.
RAM WRITES: In-memory track states.
PERSISTS: None.
PRIMARY RISK: Track swaps can occur during heavy overlap/crossing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Dict, List, Optional, Tuple

from anm_backend.services.identity_runtime.types import utc_now_iso


def _normalize(value: Any) -> str:
    return str(value or "").strip()


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _box_to_tuple(face_box: Dict[str, Any]) -> Tuple[float, float, float, float]:
    x = float(face_box.get("x", 0))
    y = float(face_box.get("y", 0))
    w = max(1.0, float(face_box.get("w", 1)))
    h = max(1.0, float(face_box.get("h", 1)))
    return x, y, w, h


def _iou(box_a: Tuple[float, float, float, float], box_b: Tuple[float, float, float, float]) -> float:
    ax, ay, aw, ah = box_a
    bx, by, bw, bh = box_b
    ax2 = ax + aw
    ay2 = ay + ah
    bx2 = bx + bw
    by2 = by + bh
    ix1 = max(ax, bx)
    iy1 = max(ay, by)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    union = max(1e-6, aw * ah + bw * bh - inter)
    return float(_clamp(inter / union, 0.0, 1.0))


@dataclass
class FaceTrack:
    track_id: str
    source_id: str
    bbox: Tuple[float, float, float, float]
    first_seen_at: str
    last_seen_at: str
    hits: int = 1
    misses: int = 0
    confidence_avg: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        x, y, w, h = self.bbox
        return {
            "track_id": self.track_id,
            "source_id": self.source_id,
            "bbox": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
            "first_seen_at": self.first_seen_at,
            "last_seen_at": self.last_seen_at,
            "hits": int(self.hits),
            "misses": int(self.misses),
            "confidence_avg": float(_clamp(self.confidence_avg, 0.0, 1.0)),
        }


@dataclass
class TemporalTracker:
    iou_threshold: float = 0.28
    max_misses: int = 10
    _lock: RLock = field(default_factory=RLock, init=False, repr=False)
    _tracks_by_source: Dict[str, Dict[str, FaceTrack]] = field(default_factory=dict, init=False, repr=False)
    _next_id: int = field(default=1, init=False, repr=False)

    def update(
        self,
        *,
        source_id: str,
        detections: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        source_key = _normalize(source_id) or "default-source"
        now_iso = utc_now_iso()
        with self._lock:
            source_tracks = self._tracks_by_source.setdefault(source_key, {})

            unmatched_tracks = set(source_tracks.keys())
            assignments: List[Tuple[int, str, float]] = []
            detection_boxes = [_box_to_tuple(item) for item in detections]

            for det_index, det_box in enumerate(detection_boxes):
                best_track_id: Optional[str] = None
                best_iou = 0.0
                for track_id in unmatched_tracks:
                    score = _iou(det_box, source_tracks[track_id].bbox)
                    if score > best_iou:
                        best_iou = score
                        best_track_id = track_id
                if best_track_id and best_iou >= self.iou_threshold:
                    assignments.append((det_index, best_track_id, best_iou))
                    unmatched_tracks.discard(best_track_id)

            assigned_det_indexes = {index for index, _, _ in assignments}
            for track_id in list(unmatched_tracks):
                track = source_tracks[track_id]
                track.misses += 1
                if track.misses > self.max_misses:
                    del source_tracks[track_id]

            for det_index, track_id, _score in assignments:
                det = detections[det_index]
                track = source_tracks[track_id]
                track.bbox = detection_boxes[det_index]
                track.last_seen_at = now_iso
                track.hits += 1
                track.misses = 0
                confidence = float(det.get("confidence", 0.0))
                previous_weight = max(1, track.hits - 1)
                track.confidence_avg = ((track.confidence_avg * previous_weight) + confidence) / max(1, track.hits)
                det["track_id"] = track.track_id
                det["track_hits"] = track.hits
                det["track_misses"] = track.misses

            for det_index, det in enumerate(detections):
                if det_index in assigned_det_indexes:
                    continue
                track_id = f"track-{self._next_id:05d}"
                self._next_id += 1
                confidence = float(det.get("confidence", 0.0))
                track = FaceTrack(
                    track_id=track_id,
                    source_id=source_key,
                    bbox=detection_boxes[det_index],
                    first_seen_at=now_iso,
                    last_seen_at=now_iso,
                    hits=1,
                    misses=0,
                    confidence_avg=confidence,
                )
                source_tracks[track_id] = track
                det["track_id"] = track_id
                det["track_hits"] = 1
                det["track_misses"] = 0

            return detections

    def get_track(self, *, source_id: str, track_id: str) -> Optional[Dict[str, Any]]:
        source_key = _normalize(source_id) or "default-source"
        key = _normalize(track_id)
        if not key:
            return None
        with self._lock:
            track = self._tracks_by_source.get(source_key, {}).get(key)
            return track.to_dict() if track else None

    def list_tracks(self, *, source_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._lock:
            if source_id:
                source_key = _normalize(source_id)
                tracks = list(self._tracks_by_source.get(source_key, {}).values())
            else:
                tracks = [item for rows in self._tracks_by_source.values() for item in rows.values()]
        tracks.sort(key=lambda item: item.last_seen_at, reverse=True)
        return [item.to_dict() for item in tracks]

