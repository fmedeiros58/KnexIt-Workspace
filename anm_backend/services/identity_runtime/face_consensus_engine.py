"""
FILE: services/identity_runtime/face_consensus_engine.py
RESPONSIBILITY: Aggregate multi-layer evidence into a final decision state.
FLOW ROLE: Layer-12 multicriteria consensus for identity runtime.
READS: Detection, quality, liveness, temporal and optional embedding signals.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: Weight calibration impacts precision/recall tradeoff.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


@dataclass
class FaceConsensusResult:
    status: str
    confidence: float
    score: float
    signals: Dict[str, float]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "confidence": float(_clamp(self.confidence, 0.0, 1.0)),
            "score": float(_clamp(self.score, 0.0, 1.0)),
            "signals": dict(self.signals),
        }


@dataclass
class FaceConsensusEngine:
    reject_threshold: float = 0.34
    suspect_threshold: float = 0.52
    candidate_threshold: float = 0.68
    confirm_threshold: float = 0.82

    def evaluate(self, *, signals: Dict[str, Any]) -> FaceConsensusResult:
        detection_conf = float(_clamp(float(signals.get("detection_conf", 0.0)), 0.0, 1.0))
        quality_score = float(_clamp(float(signals.get("quality_score", 0.0)), 0.0, 1.0))
        embedding_primary = float(_clamp(float(signals.get("embedding_primary", 0.0)), 0.0, 1.0))
        embedding_secondary = float(_clamp(float(signals.get("embedding_secondary", 0.0)), 0.0, 1.0))
        temporal_score = float(_clamp(float(signals.get("temporal_score", 0.0)), 0.0, 1.0))
        passive_liveness = float(_clamp(float(signals.get("passive_liveness", 0.0)), 0.0, 1.0))
        active_liveness = float(_clamp(float(signals.get("active_liveness", 0.0)), 0.0, 1.0))
        pose_camera_coherence = float(_clamp(float(signals.get("pose_camera_coherence", 0.0)), 0.0, 1.0))
        track_persistence = float(_clamp(float(signals.get("track_persistence", 0.0)), 0.0, 1.0))

        # If secondary embedding or active liveness are unavailable they should not dominate the score.
        has_embedding_secondary = 1.0 if signals.get("embedding_secondary") is not None else 0.0
        has_active_liveness = 1.0 if signals.get("active_liveness") is not None else 0.0

        score = (
            (0.14 * detection_conf)
            + (0.14 * quality_score)
            + (0.22 * embedding_primary)
            + (0.10 * embedding_secondary * has_embedding_secondary)
            + (0.14 * temporal_score)
            + (0.08 * passive_liveness)
            + (0.08 * active_liveness * has_active_liveness)
            + (0.06 * pose_camera_coherence)
            + (0.04 * track_persistence)
        )
        score = float(_clamp(score, 0.0, 1.0))

        if score < self.reject_threshold:
            status = "rejected"
        elif score < self.suspect_threshold:
            status = "suspect"
        elif score < self.candidate_threshold:
            status = "candidate"
        elif score < self.confirm_threshold:
            status = "candidate"
        else:
            status = "confirmed"

        return FaceConsensusResult(
            status=status,
            confidence=score,
            score=score,
            signals={
                "detection_conf": detection_conf,
                "quality_score": quality_score,
                "embedding_primary": embedding_primary,
                "embedding_secondary": embedding_secondary if has_embedding_secondary else 0.0,
                "temporal_score": temporal_score,
                "passive_liveness": passive_liveness,
                "active_liveness": active_liveness if has_active_liveness else 0.0,
                "pose_camera_coherence": pose_camera_coherence,
                "track_persistence": track_persistence,
            },
        )

