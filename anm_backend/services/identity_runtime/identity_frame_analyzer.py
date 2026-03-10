"""
FILE: services/identity_runtime/identity_frame_analyzer.py
RESPONSIBILITY: Orchestrate frame analysis layers for identity runtime.
FLOW ROLE: Execute detect -> pose -> quality for API-consumable recognition signals.
READS: Frame payloads and optional expected-view hints.
RAM WRITES: Delegated quality gate motion baseline.
PERSISTS: None directly.
PRIMARY RISK: Misaligned expected-view rules can increase false negatives.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from anm_backend.services.identity_runtime.face_aligner import FaceAligner
from anm_backend.services.identity_runtime.face_consensus_engine import FaceConsensusEngine
from anm_backend.services.identity_runtime.face_detector import FaceDetector
from anm_backend.services.identity_runtime.frame_codec import decode_frame_data_url
from anm_backend.services.identity_runtime.face_normalizer import FaceNormalizer
from anm_backend.services.identity_runtime.frame_quality_gate import FrameQualityGate
from anm_backend.services.identity_runtime.passive_liveness_checker import PassiveLivenessChecker
from anm_backend.services.identity_runtime.pose_estimator import PoseEstimator
from anm_backend.services.identity_runtime.temporal_tracker import TemporalTracker


def _normalize(value: Any) -> str:
    return str(value or "").strip()


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _infer_expected_view(source_id: str, explicit_view: Optional[str]) -> Optional[str]:
    if explicit_view:
        key = _normalize(explicit_view).lower()
    else:
        key = _normalize(source_id).lower()
    if not key:
        return None
    if key in {"front", "frontal", "main", "center"}:
        return "front"
    if key in {"left", "left-profile", "lateral-left"}:
        return "left"
    if key in {"right", "right-profile", "lateral-right"}:
        return "right"
    if key in {"environment-left", "validation-left", "env-left"}:
        return "left"
    if key in {"environment-front", "validation-front", "env-front"}:
        return "front"
    if key in {"environment-right", "validation-right", "env-right"}:
        return "right"
    if "channel-2" in key or "canal-2" in key or "left" in key:
        return "left"
    if "channel-3" in key or "canal-3" in key or "front" in key:
        return "front"
    if "channel-4" in key or "canal-4" in key or "right" in key:
        return "right"
    return None


def _crop_face(frame_bgr, face_box: Dict[str, Any]):
    if frame_bgr is None or getattr(frame_bgr, "size", 0) <= 0:
        return None
    height, width = frame_bgr.shape[:2]
    x = int(max(0, min(width - 1, float(face_box.get("x", 0)))))
    y = int(max(0, min(height - 1, float(face_box.get("y", 0)))))
    w = int(max(1, min(width - x, float(face_box.get("w", 1)))))
    h = int(max(1, min(height - y, float(face_box.get("h", 1)))))
    if w <= 1 or h <= 1:
        return None
    roi = frame_bgr[y : y + h, x : x + w]
    if roi is None or getattr(roi, "size", 0) <= 0:
        return None
    return roi


@dataclass
class IdentityFaceLayerResult:
    track_id: str
    track_hits: int
    confidence: float
    suggested_mode: str
    validation_pending: bool
    should_capture: bool
    face_box: Dict[str, Any]
    pose: Dict[str, Any]
    quality: Dict[str, Any]
    passive_liveness: Dict[str, Any]
    consensus: Dict[str, Any]
    alignment: Dict[str, Any]
    normalization: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track_id": self.track_id,
            "track_hits": int(self.track_hits),
            "confidence": float(_clamp(self.confidence, 0.0, 1.0)),
            "suggested_mode": self.suggested_mode,
            "validation_pending": bool(self.validation_pending),
            "should_capture": bool(self.should_capture),
            "face_box": dict(self.face_box),
            "pose": dict(self.pose),
            "quality": dict(self.quality),
            "passive_liveness": dict(self.passive_liveness),
            "consensus": dict(self.consensus),
            "alignment": dict(self.alignment),
            "normalization": dict(self.normalization),
        }


@dataclass
class IdentityFrameAnalysis:
    source_id: str
    face_detected: bool
    confidence: float
    expected_view: Optional[str]
    suggested_mode: str
    validation_pending: bool
    should_capture: bool
    face_box: Optional[Dict[str, Any]]
    pose: Optional[Dict[str, Any]]
    quality: Optional[Dict[str, Any]]
    faces: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "face_detected": self.face_detected,
            "confidence": self.confidence,
            "expected_view": self.expected_view,
            "suggested_mode": self.suggested_mode,
            "validation_pending": self.validation_pending,
            "should_capture": self.should_capture,
            "face_box": self.face_box,
            "pose": self.pose,
            "quality": self.quality,
            "faces": list(self.faces),
        }


@dataclass
class IdentityFrameAnalyzer:
    face_detector: FaceDetector
    pose_estimator: PoseEstimator
    quality_gate: FrameQualityGate
    temporal_tracker: Optional[TemporalTracker] = None
    face_aligner: Optional[FaceAligner] = None
    face_normalizer: Optional[FaceNormalizer] = None
    passive_liveness_checker: Optional[PassiveLivenessChecker] = None
    face_consensus_engine: Optional[FaceConsensusEngine] = None

    def analyze(
        self,
        *,
        frame_data_url: str,
        source_id: str,
        expected_view: Optional[str] = None,
        track_key: str = "",
        min_quality_score: float = 0.55,
        require_pose_match: bool = True,
        max_faces: int = 4,
    ) -> IdentityFrameAnalysis:
        frame = decode_frame_data_url(frame_data_url)
        resolved_view = _infer_expected_view(source_id=source_id, explicit_view=expected_view)
        safe_max_faces = max(1, min(12, int(max_faces)))
        detections = self.face_detector.detect_faces(frame, max_faces=safe_max_faces)

        if not detections:
            return IdentityFrameAnalysis(
                source_id=_normalize(source_id),
                face_detected=False,
                confidence=0.0,
                expected_view=resolved_view,
                suggested_mode="tracking",
                validation_pending=True,
                should_capture=False,
                face_box=None,
                pose=None,
                quality=None,
                faces=[],
            )

        source_key = _normalize(source_id) or "identity-source"
        tracker_rows = [item.to_dict() for item in detections]
        if self.temporal_tracker:
            tracker_rows = self.temporal_tracker.update(source_id=source_key, detections=tracker_rows)
        else:
            tracker_rows = [dict(item, track_id=f"{source_key}:det-{index+1}", track_hits=1) for index, item in enumerate(tracker_rows)]

        resolved_track_key = _normalize(track_key) or source_key or "identity-track"
        face_results: List[IdentityFaceLayerResult] = []
        for index, row in enumerate(tracker_rows):
            face_box = {
                "x": int(row.get("x", 0)),
                "y": int(row.get("y", 0)),
                "w": int(row.get("w", 1)),
                "h": int(row.get("h", 1)),
                "confidence": float(_clamp(float(row.get("confidence", 0.0)), 0.0, 1.0)),
            }
            track_id = _normalize(row.get("track_id")) or f"{source_key}:det-{index+1}"
            track_hits = max(1, int(row.get("track_hits", 1)))

            face_roi = _crop_face(frame, face_box) or frame
            pose = self.pose_estimator.estimate_pose(face_roi, expected_view=resolved_view)
            pose_dict = pose.to_dict()

            quality = self.quality_gate.evaluate(
                frame,
                face_box,
                track_key=f"{resolved_track_key}:{track_id}",
                min_overall_score=float(_clamp(min_quality_score, 0.15, 0.99)),
            )
            quality_dict = quality.to_dict()

            pose_match = bool(pose_dict.get("pose_match", False))
            if require_pose_match and not pose_match:
                reasons = quality_dict.setdefault("reasons", [])
                if "pose_mismatch" not in reasons:
                    reasons.append("pose_mismatch")
                quality_dict["approved"] = False

            aligned_face = self.face_aligner.align(frame, face_box=face_box, pose=pose_dict) if self.face_aligner else _crop_face(frame, face_box)
            aligned_shape = list(aligned_face.shape[:2]) if aligned_face is not None else []
            normalized_face = self.face_normalizer.normalize(aligned_face) if (self.face_normalizer and aligned_face is not None) else None

            passive_liveness = (
                self.passive_liveness_checker.update(track_id=track_id, face_box=face_box, pose=pose_dict).to_dict()
                if self.passive_liveness_checker
                else {"status": "pending", "confidence": 0.4, "evidence": {"reason": "passive_checker_unavailable"}}
            )
            liveness_conf = float(passive_liveness.get("confidence", 0.0))

            quality_score = float(quality_dict.get("overall_score", 0.0))
            detection_conf = float(face_box.get("confidence", 0.0))
            confidence = _clamp(detection_conf * max(0.35, quality_score), 0.0, 1.0)

            consensus = (
                self.face_consensus_engine.evaluate(
                    signals={
                        "detection_conf": detection_conf,
                        "quality_score": quality_score,
                        "embedding_primary": 0.0,
                        "embedding_secondary": None,
                        "temporal_score": _clamp(track_hits / 8.0, 0.0, 1.0),
                        "passive_liveness": liveness_conf,
                        "active_liveness": None,
                        "pose_camera_coherence": 1.0 if pose_match else 0.0,
                        "track_persistence": _clamp(track_hits / 10.0, 0.0, 1.0),
                    }
                ).to_dict()
                if self.face_consensus_engine
                else {"status": "candidate", "confidence": confidence, "score": confidence, "signals": {}}
            )

            should_capture = bool(quality_dict.get("approved", False)) and bool(consensus.get("status") in {"candidate", "confirmed"})
            suggested_mode = "verification" if should_capture else "tracking"
            validation_pending = not should_capture

            face_results.append(
                IdentityFaceLayerResult(
                    track_id=track_id,
                    track_hits=track_hits,
                    confidence=confidence,
                    suggested_mode=suggested_mode,
                    validation_pending=validation_pending,
                    should_capture=should_capture,
                    face_box=face_box,
                    pose=pose_dict,
                    quality=quality_dict,
                    passive_liveness=passive_liveness,
                    consensus=consensus,
                    alignment={
                        "applied": bool(aligned_face is not None),
                        "shape": aligned_shape,
                    },
                    normalization={
                        "applied": bool(normalized_face is not None),
                        "shape": (normalized_face or {}).get("shape", []),
                        "mean_luma": (normalized_face or {}).get("mean_luma"),
                    },
                )
            )

        face_rows = [item.to_dict() for item in face_results]
        best_face = max(face_results, key=lambda item: item.confidence) if face_results else None
        should_capture_frame = any(item.should_capture for item in face_results)
        if best_face:
            confidence = best_face.confidence
            suggested_mode = best_face.suggested_mode
            validation_pending = best_face.validation_pending
            best_face_box = best_face.face_box
            best_pose = best_face.pose
            best_quality = best_face.quality
        else:
            confidence = 0.0
            suggested_mode = "tracking"
            validation_pending = True
            best_face_box = None
            best_pose = None
            best_quality = None

        return IdentityFrameAnalysis(
            source_id=_normalize(source_id),
            face_detected=True,
            confidence=confidence,
            expected_view=resolved_view,
            suggested_mode=suggested_mode,
            validation_pending=validation_pending,
            should_capture=should_capture_frame,
            face_box=best_face_box,
            pose=best_pose,
            quality=best_quality,
            faces=face_rows,
        )
