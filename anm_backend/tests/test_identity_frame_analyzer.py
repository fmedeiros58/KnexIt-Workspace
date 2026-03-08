import unittest
from unittest.mock import patch

from anm_backend.services.identity_runtime.identity_frame_analyzer import IdentityFrameAnalyzer


class _FakeFace:
    def __init__(self, confidence: float) -> None:
        self.confidence = confidence

    def to_dict(self):
        return {"x": 10, "y": 8, "w": 64, "h": 64, "confidence": self.confidence}


class _DetectorNoFace:
    def detect_faces(self, _frame, *, max_faces: int = 1):
        return []


class _DetectorOneFace:
    def detect_faces(self, _frame, *, max_faces: int = 1):
        return [_FakeFace(0.92)]


class _PoseMatch:
    def estimate_pose(self, _frame, *, expected_view=None):
        class _R:
            def to_dict(self_inner):
                return {
                    "pose_label": "front",
                    "yaw": 1.0,
                    "pitch": 0.5,
                    "roll": 0.1,
                    "confidence": 0.95,
                    "pose_match": True,
                    "expected_view": expected_view,
                    "landmarks_detected": True,
                }

        return _R()


class _QualityApproved:
    def evaluate(self, _frame, _box, *, track_key: str = "", min_overall_score: float = 0.55):
        class _R:
            def to_dict(self_inner):
                return {
                    "blur_score": 0.9,
                    "lighting_score": 0.8,
                    "framing_score": 0.88,
                    "stability_score": 0.84,
                    "overall_score": 0.86,
                    "approved": True,
                    "reasons": [],
                }

        return _R()


class IdentityFrameAnalyzerTests(unittest.TestCase):
    def test_analyze_without_face_returns_tracking_pending(self) -> None:
        analyzer = IdentityFrameAnalyzer(
            face_detector=_DetectorNoFace(),
            pose_estimator=_PoseMatch(),
            quality_gate=_QualityApproved(),
        )
        with patch("anm_backend.services.identity_runtime.identity_frame_analyzer.decode_frame_data_url", return_value=object()):
            result = analyzer.analyze(
                frame_data_url="data:image/png;base64,AAAA",
                source_id="channel-3",
                expected_view="front",
            )
        self.assertFalse(result.face_detected)
        self.assertEqual(result.suggested_mode, "tracking")
        self.assertTrue(result.validation_pending)
        self.assertFalse(result.should_capture)

    def test_analyze_with_face_and_quality_approved_returns_verification(self) -> None:
        analyzer = IdentityFrameAnalyzer(
            face_detector=_DetectorOneFace(),
            pose_estimator=_PoseMatch(),
            quality_gate=_QualityApproved(),
        )
        with patch("anm_backend.services.identity_runtime.identity_frame_analyzer.decode_frame_data_url", return_value=object()):
            result = analyzer.analyze(
                frame_data_url="data:image/png;base64,AAAA",
                source_id="channel-3",
                expected_view="front",
                min_quality_score=0.55,
                require_pose_match=True,
            )
        self.assertTrue(result.face_detected)
        self.assertEqual(result.suggested_mode, "verification")
        self.assertFalse(result.validation_pending)
        self.assertTrue(result.should_capture)
        self.assertGreater(result.confidence, 0.7)


if __name__ == "__main__":
    unittest.main()

