import os
import unittest

from anm_backend.contracts import EngineResponse
from anm_backend.services.response_orchestration.clarification_repair_manager_service import (
    ClarificationRepairManagerService,
)
from anm_backend.services.response_orchestration.response_critic_service import ResponseCriticService
from anm_backend.services.response_orchestration.response_orchestrator import ResponseOrchestrator
from anm_backend.services.response_orchestration.types import OrchestrationRequest


class _DummyEngineClient:
    model_name = "dummy-model"

    def build_request(self, **kwargs):  # noqa: ANN003, ANN201
        return kwargs

    def engine_request_to_payload(self, request):  # noqa: ANN001, ANN201
        return request

    def invoke(self, payload, *, trace_id):  # noqa: ANN001, ANN201, ARG002
        raise RuntimeError("unexpected_engine_invoke")


class _DummyResponseParser:
    def parse(self, raw, *, trace_id):  # noqa: ANN001, ANN201, ARG002
        raise RuntimeError("unexpected_parse")


class _DummyLLMAdapter:
    def __init__(self) -> None:
        self.engine_client = _DummyEngineClient()
        self.response_parser = _DummyResponseParser()


class SupplementationPipelineTests(unittest.TestCase):
    _ENV_KEYS = [
        "SECONDARY_PROCESS_MEMORY_ENABLED",
        "CHAT_SECONDARY_PROCESS_MEMORY_ENABLED",
        "RESPONSE_ORCHESTRATION_MAX_CYCLES",
        "CHAT_MAX_RESPONSE_CYCLES",
        "FORCE_FINAL_SYNTHESIS",
    ]

    def setUp(self) -> None:
        self._env_snapshot = {key: os.environ.get(key) for key in self._ENV_KEYS}

    def tearDown(self) -> None:
        for key, value in self._env_snapshot.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def _engine_response(self, *, trace_id: str, text: str) -> EngineResponse:
        return EngineResponse(
            trace_id=trace_id,
            model="dummy-model",
            text=text,
            usage={"completion_tokens": max(8, int(len(text) / 4))},
            raw={"choices": [{"message": {"content": text}}]},
        )

    def test_multi_pass_exports_supplementation_telemetry_and_memory_state(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["CHAT_SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["RESPONSE_ORCHESTRATION_MAX_CYCLES"] = "2"
        os.environ["CHAT_MAX_RESPONSE_CYCLES"] = "2"
        os.environ["FORCE_FINAL_SYNTHESIS"] = "0"

        orchestrator = ResponseOrchestrator(llm_adapter=_DummyLLMAdapter())  # type: ignore[arg-type]

        def cycle_generator(gen_req):
            idx = int(gen_req.cycle_index)
            blocks = {
                1: "Bloco 1: estabilidade do vLLM com foco em latencia, fila e continuidade argumentativa.",
                2: "Bloco 2: fechamento analitico sem reinicio discursivo, com recomendacoes operacionais.",
            }
            return self._engine_response(
                trace_id=gen_req.trace_id,
                text=blocks.get(idx, f"Bloco {idx}: continuidade."),
            )

        request = OrchestrationRequest(
            request_id="trace-supplementation",
            mode="chat",
            user_id="user-sup",
            prompt_original=(
                "Analise a estabilidade do vLLM em dois blocos com continuidade, "
                "depois conclua com recomendacoes objetivas."
            ),
            objective_current="Analise em dois blocos",
            context_payload={"context": "suplementacao"},
            max_tokens=512,
            temperature=0.2,
            top_p=0.9,
            prefer_multi_pass=True,
            max_cycles_override=2,
            min_cycles_override=2,
            planner_hints=["nucleo", "fechamento"],
            cycle_generator=cycle_generator,
        )
        result = orchestrator.orchestrate(request=request)

        self.assertEqual(result.response_mode, "multi_pass")
        self.assertEqual(result.cycle_count, 2)
        self.assertIn("call_plan", result.telemetry["plan"])
        self.assertIn("response_check", result.telemetry)
        self.assertIn("repair_strategy", result.telemetry)
        self.assertIn("dialogue_state", result.telemetry)
        self.assertIn("turn_function", result.telemetry)

        state = orchestrator.secondary_memory_service.get_session(session_id=result.session_id)
        self.assertIsNotNone(state)
        assert state is not None
        self.assertTrue(bool(state.rolling_summary))
        self.assertTrue(isinstance(state.compressed_state, dict))
        self.assertTrue(isinstance(state.semantic_state, dict))
        self.assertTrue(isinstance(state.reflective_report, dict))
        self.assertTrue(isinstance(state.inference_map, dict))

    def test_clarification_repair_detects_ambiguity(self) -> None:
        service = ClarificationRepairManagerService()
        strategy = service.decide(prompt_original="Isso aqui?")
        self.assertTrue(strategy.should_ask_clarification)
        self.assertEqual(strategy.mode, "clarify")

    def test_response_critic_flags_low_alignment(self) -> None:
        service = ResponseCriticService()
        check = service.evaluate(
            prompt_original="Analise arquitetura, redundancia e continuidade textual",
            response_text="resposta curta",
        )
        self.assertFalse(check.passed)
        self.assertTrue(
            ("response_too_short" in check.findings) or ("low_prompt_alignment" in check.findings)
        )
