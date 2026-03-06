import os
import unittest

from anm_backend.services.response_orchestration.continuity_bridge_service import ContinuityBridgeService
from anm_backend.services.response_orchestration.micro_assembler_service import MicroAssemblerService
from anm_backend.services.response_orchestration.paragraph_segmenter_service import ParagraphSegmenterService
from anm_backend.services.response_orchestration.types import EmissionPlan, OrchestrationRequest


class Phase0SegmentationTests(unittest.TestCase):
    _ENV_KEYS = [
        "PHASE0_SEGMENTED_EMISSION_ENABLED",
        "PHASE0_CHAT_SEGMENTED_EMISSION_ENABLED",
        "PHASE0_SEGMENTED_EMISSION_AUTO_ENABLED",
        "PHASE0_DENSITY_SHORT_THRESHOLD",
        "PHASE0_DENSITY_MEDIUM_THRESHOLD",
        "PHASE0_MAX_CALLS",
        "PHASE0_FIRST_CHUNK_MIN_TOKENS",
        "PHASE0_FIRST_CHUNK_TARGET_TOKENS",
        "PHASE0_FIRST_CHUNK_MAX_TOKENS",
        "PHASE0_PER_CALL_MAX_TOKENS",
    ]

    def setUp(self) -> None:
        self._env_snapshot = {key: os.environ.get(key) for key in self._ENV_KEYS}
        os.environ["PHASE0_SEGMENTED_EMISSION_ENABLED"] = "1"
        os.environ["PHASE0_CHAT_SEGMENTED_EMISSION_ENABLED"] = "1"
        os.environ["PHASE0_SEGMENTED_EMISSION_AUTO_ENABLED"] = "0"

    def tearDown(self) -> None:
        for key, value in self._env_snapshot.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def _base_plan(self) -> EmissionPlan:
        return EmissionPlan(
            response_mode="multi_pass",
            should_use_multi_pass=True,
            complexity_score=1.4,
            planned_sections=["secao_1", "secao_2", "secao_3"],
            max_cycles=3,
            target_chunk_tokens=320,
            max_total_response_tokens=1200,
            min_cycles_required=2,
            rationale=["baseline"],
        )

    def _request(self, prompt: str) -> OrchestrationRequest:
        return OrchestrationRequest(
            request_id="trace-phase0",
            mode="chat",
            user_id="user-phase0",
            prompt_original=prompt,
            objective_current=prompt,
            context_payload={"ctx": "x"},
            max_tokens=2048,
            temperature=0.2,
            top_p=0.9,
            metadata={"phase0_segmented_emission": True},
        )

    def test_segmenter_scales_calls_by_density(self) -> None:
        segmenter = ParagraphSegmenterService()
        short_decision = segmenter.decide(
            request=self._request("Explique latencia de inferencia."),
            base_plan=self._base_plan(),
        )
        medium_decision = segmenter.decide(
            request=self._request(
                "Explique como a estabilidade do vLLM oscila sob carga media, com foco em fila, "
                "throughput e impacto no tempo de resposta."
            ),
            base_plan=self._base_plan(),
        )
        long_decision = segmenter.decide(
            request=self._request(
                "Analise em detalhes os trade-offs entre latencia, throughput, batch dinamico, "
                "tempo de fila e timeout em cenarios de alta concorrencia, comparando estrategias "
                "de segmentacao, continuidade textual e fechamento sintatico para manter previsibilidade "
                "operacional enquanto reduz pressao de VRAM e variacao de resposta."
            ),
            base_plan=self._base_plan(),
        )

        self.assertTrue(short_decision.enabled)
        self.assertEqual(short_decision.call_count, 1)
        self.assertEqual(medium_decision.call_count, 2)
        self.assertEqual(long_decision.call_count, 3)
        self.assertGreaterEqual(long_decision.first_chunk_min_tokens, 96)
        self.assertLessEqual(long_decision.first_chunk_max_tokens, 260)

    def test_continuity_bridge_enforces_open_syntax(self) -> None:
        bridge = ContinuityBridgeService()
        bridge_state = bridge.prepare_first_chunk(
            first_chunk="A estabilidade do motor degrada com carga elevada.",
            preferred_connector="sobretudo quando",
            join_rule="segunda chamada nao reinicia sujeito principal",
        )

        self.assertTrue(bridge_state.injected_connector)
        self.assertTrue(bridge_state.first_chunk.lower().endswith("sobretudo quando"))
        self.assertIn("sobretudo quando", bridge_state.continuation_anchor.lower())

    def test_micro_assembler_merges_without_visible_stitch(self) -> None:
        assembler = MicroAssemblerService()
        merged = assembler.assemble_paragraph(
            first_chunk="A estabilidade da inferencia perde previsibilidade sobretudo quando",
            continuation_chunk=(
                "Sobretudo quando a fila cresce de forma desigual, o throughput oscila "
                "e o tempo de resposta aumenta."
            ),
            continuation_anchor="sobretudo quando",
            join_rule="segunda chamada nao reinicia sujeito principal",
        )

        self.assertNotIn("\n", merged)
        self.assertEqual(merged.lower().count("sobretudo quando"), 1)
        self.assertIn("tempo de resposta aumenta", merged.lower())


if __name__ == "__main__":
    unittest.main()
