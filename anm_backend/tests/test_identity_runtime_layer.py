import unittest

from anm_backend.services.identity_runtime import (
    ContinuousIdentityRuntime,
    MultiCameraStreamManager,
    SelfModelEngine,
    SourceDiscoveryManager,
    UserPatternRecognizer,
)


class IdentityRuntimeLayerTests(unittest.TestCase):
    def test_runtime_tracks_and_identifies_entity(self) -> None:
        source_manager = SourceDiscoveryManager()
        stream_manager = MultiCameraStreamManager(source_manager=source_manager)
        runtime = ContinuousIdentityRuntime(source_manager=source_manager, stream_manager=stream_manager)

        runtime.enable_runtime(reason="unit_test_enable", persist=False)
        runtime.select_source("webcam-main")
        runtime.submit_observation(
            {
                "source_id": "webcam-main",
                "face_detected": True,
                "entity_id": "person_01",
                "label": "person_01",
                "confidence": 0.91,
                "mode": "verification",
                "nominal_name": "Usuario principal",
                "validation_pending": False,
                "conflict": False,
            }
        )
        runtime._runtime_tick()  # noqa: SLF001

        snapshot = runtime.snapshot().to_dict()
        self.assertTrue(snapshot["runtime_enabled"])
        self.assertEqual(snapshot["status"], "identified")
        self.assertTrue(bool(snapshot["awareness_state"]["someone_in_frame"]))
        self.assertTrue(bool(snapshot["awareness_state"]["identity_confirmed"]))
        self.assertEqual(snapshot["current_identity"]["entity_id"], "person_01")
        runtime.shutdown()

    def test_user_pattern_recognizer_profiles_density_and_topics(self) -> None:
        recognizer = UserPatternRecognizer()
        recognizer.observe_message(user_key="u1", message="Boa tarde")
        recognizer.observe_message(user_key="u1", message="Quero uma analise detalhada de estabilidade operacional")
        recognizer.observe_message(user_key="u1", message="Corrija e ajuste o texto anterior")

        state = recognizer.snapshot(user_key="u1")
        profile = state["user_interaction_profile"]
        discourse = state["user_discourse_pattern"]
        self.assertEqual(int(profile["turn_count"]), 3)
        self.assertIn("preferred_density", profile)
        self.assertTrue(len(discourse["recurrent_topics"]) >= 1)

    def test_self_model_engine_answers_from_runtime_state(self) -> None:
        source_manager = SourceDiscoveryManager()
        stream_manager = MultiCameraStreamManager(source_manager=source_manager)
        runtime = ContinuousIdentityRuntime(source_manager=source_manager, stream_manager=stream_manager)
        model = SelfModelEngine(runtime=runtime)

        answer = model.answer_self_query(question="Quem e voce e quais sao seus limites?")
        self.assertIn("camada cognitiva", answer.lower())
        self.assertIn("nao afirmo consciencia", answer.lower())
        self.assertIn("reidentifico entidades anonimas", answer.lower())


if __name__ == "__main__":
    unittest.main()

