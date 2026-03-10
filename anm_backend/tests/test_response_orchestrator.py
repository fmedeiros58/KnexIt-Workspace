import os
import unittest

from anm_backend.contracts import EngineResponse
from anm_backend.services.response_orchestration.response_orchestrator import ResponseOrchestrator
from anm_backend.services.response_orchestration.secondary_process_memory_service import SecondaryProcessMemoryService
from anm_backend.services.response_orchestration.types import EmissionPlan, OrchestrationRequest


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


class _SpyRuntimeSqlPersistenceService:
    def __init__(self) -> None:
        self.register_calls = []
        self.record_calls = []
        self.finalize_calls = []

    def register_session(self, **kwargs):  # noqa: ANN003, ANN201
        self.register_calls.append(kwargs)

    def record_cycle(self, **kwargs):  # noqa: ANN003, ANN201
        self.record_calls.append(kwargs)

    def finalize_session(self, **kwargs):  # noqa: ANN003, ANN201
        self.finalize_calls.append(kwargs)


class ResponseOrchestratorTests(unittest.TestCase):
    _ENV_KEYS = [
        "SECONDARY_PROCESS_MEMORY_ENABLED",
        "CHAT_SECONDARY_PROCESS_MEMORY_ENABLED",
        "WRITE_SECONDARY_PROCESS_MEMORY_ENABLED",
        "SECONDARY_PROCESS_MEMORY_CROSS_CALL_ENABLED",
        "CHAT_SECONDARY_PROCESS_MEMORY_CROSS_CALL_ENABLED",
        "WRITE_SECONDARY_PROCESS_MEMORY_CROSS_CALL_ENABLED",
        "RESPONSE_ORCHESTRATION_MAX_CYCLES",
        "CHAT_MAX_RESPONSE_CYCLES",
        "TARGET_CHUNK_TOKENS",
        "MAX_TOTAL_RESPONSE_TOKENS",
        "FORCE_FINAL_SYNTHESIS",
        "REDUNDANCY_THRESHOLD",
        "PHASE0_SEGMENTED_EMISSION_ENABLED",
        "PHASE0_CHAT_SEGMENTED_EMISSION_ENABLED",
        "PHASE0_SEGMENTED_EMISSION_AUTO_ENABLED",
        "PHASE0_FIRST_CHUNK_MIN_TOKENS",
        "PHASE0_FIRST_CHUNK_TARGET_TOKENS",
        "PHASE0_FIRST_CHUNK_MAX_TOKENS",
        "PHASE0_PER_CALL_MAX_TOKENS",
        "PHASE0_PRE_EXPANSION_STRICT_ENABLED",
        "ANM_RUNTIME_SQL_PERSIST_ENABLED",
        "ANM_RUNTIME_SQL_URL",
        "ANM_RUNTIME_SQL_SERVICE_KEY",
        "ANM_RUNTIME_SQL_SCHEMA",
        "ANM_RUNTIME_SQL_TIMEOUT_S",
        "ANM_RUNTIME_SQL_FAILURE_THRESHOLD",
    ]

    def setUp(self) -> None:
        self._env_snapshot = {key: os.environ.get(key) for key in self._ENV_KEYS}
        os.environ["ANM_RUNTIME_SQL_PERSIST_ENABLED"] = "0"

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

    def test_single_pass_when_secondary_memory_disabled(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_ENABLED"] = "0"
        os.environ["CHAT_SECONDARY_PROCESS_MEMORY_ENABLED"] = "0"

        orchestrator = ResponseOrchestrator(llm_adapter=_DummyLLMAdapter())  # type: ignore[arg-type]
        request = OrchestrationRequest(
            request_id="trace-single",
            mode="chat",
            user_id="user-1",
            prompt_original="Explique rapidamente o objetivo.",
            objective_current="Explicar objetivo",
            context_payload={"context": "minimo"},
            max_tokens=256,
            temperature=0.2,
            top_p=0.9,
            single_pass_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text="Objetivo entregue em uma resposta curta e direta.",
            ),
        )
        result = orchestrator.orchestrate(request=request)

        self.assertEqual(result.response_mode, "single_pass")
        self.assertEqual(result.cycle_count, 1)
        self.assertEqual(result.stop_reason, "single_pass")
        self.assertIn("resposta curta", result.response_text.lower())
        self.assertFalse(result.fallback_used)

    def test_single_pass_persists_reflective_and_inference_artifacts(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_ENABLED"] = "0"
        os.environ["CHAT_SECONDARY_PROCESS_MEMORY_ENABLED"] = "0"

        orchestrator = ResponseOrchestrator(llm_adapter=_DummyLLMAdapter())  # type: ignore[arg-type]
        request = OrchestrationRequest(
            request_id="trace-reflective-inference",
            mode="chat",
            user_id="user-ri",
            prompt_original="Explique estabilidade e risco operacional com foco tecnico.",
            objective_current="Explicar estabilidade operacional",
            context_payload={"context": "minimo"},
            max_tokens=256,
            temperature=0.2,
            top_p=0.9,
            single_pass_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text="A estabilidade operacional exige monitoramento continuo de latencia e de filas para reduzir risco.",
            ),
        )

        result = orchestrator.orchestrate(request=request)
        state = orchestrator.secondary_memory_service.get_session(session_id=result.session_id)

        self.assertIsNotNone(state)
        assert state is not None
        self.assertIn("precision_alerts", state.reflective_report)
        self.assertIn("coherence_alerts", state.reflective_report)
        self.assertIn("suggestions", state.inference_map)
        self.assertIn("gaps", state.inference_map)
        self.assertGreaterEqual(len(state.local_decisions), 1)

    def test_runtime_sql_hooks_single_pass_are_called(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_ENABLED"] = "0"
        os.environ["CHAT_SECONDARY_PROCESS_MEMORY_ENABLED"] = "0"

        orchestrator = ResponseOrchestrator(llm_adapter=_DummyLLMAdapter())  # type: ignore[arg-type]
        spy = _SpyRuntimeSqlPersistenceService()
        orchestrator.runtime_sql_persistence_service = spy  # type: ignore[assignment]

        request = OrchestrationRequest(
            request_id="trace-runtime-sql-single-pass",
            mode="chat",
            user_id="user-runtime-sql",
            prompt_original="Explique risco operacional de forma objetiva.",
            objective_current="Explicar risco operacional",
            context_payload={"context": "minimo"},
            max_tokens=256,
            temperature=0.2,
            top_p=0.9,
            single_pass_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text="Risco operacional aumenta quando a fila cresce sem controle de latencia.",
            ),
        )
        result = orchestrator.orchestrate(request=request)

        self.assertEqual(result.response_mode, "single_pass")
        self.assertEqual(len(spy.register_calls), 1)
        self.assertEqual(len(spy.record_calls), 1)
        self.assertEqual(len(spy.finalize_calls), 1)
        self.assertEqual(int(spy.record_calls[0]["cycle_index"]), 1)
        self.assertEqual(spy.finalize_calls[0]["request_id"], result.request_id)

    def test_runtime_sql_hooks_record_multi_pass_cycles(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["CHAT_SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["RESPONSE_ORCHESTRATION_MAX_CYCLES"] = "3"
        os.environ["CHAT_MAX_RESPONSE_CYCLES"] = "3"
        os.environ["FORCE_FINAL_SYNTHESIS"] = "0"
        os.environ["REDUNDANCY_THRESHOLD"] = "0.98"

        orchestrator = ResponseOrchestrator(llm_adapter=_DummyLLMAdapter())  # type: ignore[arg-type]
        spy = _SpyRuntimeSqlPersistenceService()
        orchestrator.runtime_sql_persistence_service = spy  # type: ignore[assignment]

        request = OrchestrationRequest(
            request_id="trace-runtime-sql-multi-pass",
            mode="chat",
            user_id="user-runtime-sql-multi",
            prompt_original="Compare alternativas tecnicas em dois blocos e conclua.",
            objective_current="Comparar alternativas",
            context_payload={"context": "amplo"},
            max_tokens=512,
            temperature=0.2,
            top_p=0.9,
            prefer_multi_pass=True,
            max_cycles_override=2,
            min_cycles_override=2,
            planner_hints=["bloco 1", "bloco 2"],
            cycle_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text=(
                    "Bloco 1: compara custo e throughput." if int(gen_req.cycle_index) == 1
                    else "Bloco 2: conclui com trade-off e recomendacao final."
                ),
            ),
        )
        result = orchestrator.orchestrate(request=request)

        self.assertEqual(result.response_mode, "multi_pass")
        self.assertGreaterEqual(result.cycle_count, 2)
        self.assertEqual(len(spy.register_calls), 1)
        self.assertEqual(len(spy.finalize_calls), 1)
        self.assertGreaterEqual(len(spy.record_calls), 2)
        self.assertEqual(len(spy.record_calls), result.cycle_count)

    def test_phase0_pre_expansion_lightweight_skips_advanced_modules(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["CHAT_SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["PHASE0_SEGMENTED_EMISSION_ENABLED"] = "1"
        os.environ["PHASE0_CHAT_SEGMENTED_EMISSION_ENABLED"] = "1"
        os.environ["PHASE0_SEGMENTED_EMISSION_AUTO_ENABLED"] = "0"
        os.environ["PHASE0_PRE_EXPANSION_STRICT_ENABLED"] = "1"
        os.environ["FORCE_FINAL_SYNTHESIS"] = "0"

        orchestrator = ResponseOrchestrator(llm_adapter=_DummyLLMAdapter())  # type: ignore[arg-type]

        def _unexpected(*args, **kwargs):  # noqa: ANN002, ANN003, ANN202
            raise RuntimeError("unexpected_advanced_module_call_in_phase0_lightweight")

        orchestrator.compression_engine_service.compress = _unexpected  # type: ignore[method-assign]
        orchestrator.semantic_controller_service.decide = _unexpected  # type: ignore[method-assign]
        orchestrator.reflective_analyzer_service.analyze = _unexpected  # type: ignore[method-assign]
        orchestrator.inference_engine_service.infer = _unexpected  # type: ignore[method-assign]
        orchestrator.process_memory_manager_service.build_update = _unexpected  # type: ignore[method-assign]

        request = OrchestrationRequest(
            request_id="trace-phase0-lightweight",
            mode="chat",
            user_id="user-phase0-lightweight",
            prompt_original=(
                "Explique em um paragrafo tecnico medio como a estabilidade degrada com carga, "
                "sem reiniciar o raciocinio."
            ),
            objective_current="Paragrafo tecnico unico",
            context_payload={"context": "fase0"},
            max_tokens=768,
            temperature=0.2,
            top_p=0.9,
            prefer_multi_pass=True,
            metadata={
                "phase0_segmented_emission": True,
                "phase0_preferred_connector": "sobretudo quando",
            },
            cycle_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text=(
                    "A estabilidade degrada com saturacao de fila."
                    if int(gen_req.cycle_index) == 1
                    else "sobretudo quando o throughput oscila e o timeout aumenta no fechamento do ciclo."
                ),
            ),
        )

        result = orchestrator.orchestrate(request=request)
        self.assertEqual(result.response_mode, "multi_pass")
        self.assertEqual(result.cycle_count, 2)
        self.assertIn("throughput oscila", result.response_text.lower())
        self.assertTrue(bool(result.telemetry["plan"]["phase0"]["pre_expansion_lightweight_mode"]))

    def test_multi_pass_when_enabled_and_complex(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["CHAT_SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["RESPONSE_ORCHESTRATION_MAX_CYCLES"] = "3"
        os.environ["CHAT_MAX_RESPONSE_CYCLES"] = "3"
        os.environ["TARGET_CHUNK_TOKENS"] = "180"
        os.environ["MAX_TOTAL_RESPONSE_TOKENS"] = "1000"
        os.environ["FORCE_FINAL_SYNTHESIS"] = "0"
        os.environ["REDUNDANCY_THRESHOLD"] = "0.98"

        orchestrator = ResponseOrchestrator(llm_adapter=_DummyLLMAdapter())  # type: ignore[arg-type]

        def cycle_generator(gen_req):
            idx = int(gen_req.cycle_index)
            blocks = {
                1: "Bloco 1: mapeamento do contexto institucional, premissas historicas e delimitacao inicial do problema.",
                2: "Bloco 2: comparacao metodologica entre abordagens, com criterios tecnicos, riscos e trade-offs operacionais.",
                3: "Bloco 3: sintese conclusiva com recomendacoes praticas, implicacoes e fechamento coerente da resposta.",
            }
            return self._engine_response(
                trace_id=gen_req.trace_id,
                text=blocks.get(idx, f"Bloco {idx}: continuidade adicional."),
            )

        request = OrchestrationRequest(
            request_id="trace-multi",
            mode="chat",
            user_id="user-2",
            prompt_original=(
                "Analise em detalhes os trade-offs, compare alternativas e estruture passo a passo "
                "uma resposta profunda com continuidade argumentativa sem repetir conceitos."
            ),
            objective_current="Resposta analitica profunda",
            context_payload={"context": "amplo"},
            max_tokens=512,
            temperature=0.2,
            top_p=0.9,
            prefer_multi_pass=True,
            planner_hints=["contexto inicial", "analise comparativa", "sintese final"],
            single_pass_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text="Fallback single pass.",
            ),
            cycle_generator=cycle_generator,
        )
        result = orchestrator.orchestrate(request=request)

        self.assertEqual(result.response_mode, "multi_pass")
        self.assertGreaterEqual(result.cycle_count, 2)
        self.assertIn("bloco 1", result.response_text.lower())
        self.assertIn("bloco 2", result.response_text.lower())
        self.assertFalse(result.fallback_used)

    def test_prefer_multi_pass_forces_multi_on_low_complexity_prompt(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["CHAT_SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["RESPONSE_ORCHESTRATION_MAX_CYCLES"] = "4"
        os.environ["CHAT_MAX_RESPONSE_CYCLES"] = "4"
        os.environ["FORCE_FINAL_SYNTHESIS"] = "0"

        orchestrator = ResponseOrchestrator(llm_adapter=_DummyLLMAdapter())  # type: ignore[arg-type]

        request = OrchestrationRequest(
            request_id="trace-force-multi",
            mode="chat",
            user_id="user-force",
            prompt_original="Explique o tema.",
            objective_current="Explicar tema",
            context_payload={"context": "minimo"},
            max_tokens=512,
            temperature=0.2,
            top_p=0.9,
            prefer_multi_pass=True,
            max_cycles_override=4,
            min_cycles_override=4,
            planner_hints=["etapa 1", "etapa 2", "etapa 3", "etapa 4"],
            single_pass_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text="Fallback single pass.",
            ),
            cycle_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text=f"Bloco {gen_req.cycle_index}: desenvolvimento incremental do tema.",
            ),
        )
        result = orchestrator.orchestrate(request=request)

        self.assertEqual(result.response_mode, "multi_pass")
        self.assertGreaterEqual(result.cycle_count, 4)
        self.assertIn("bloco 1", result.response_text.lower())
        self.assertIn("bloco 4", result.response_text.lower())
        self.assertFalse(result.fallback_used)

    def test_min_cycles_required_defers_early_redundancy_stop(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["CHAT_SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["RESPONSE_ORCHESTRATION_MAX_CYCLES"] = "4"
        os.environ["CHAT_MAX_RESPONSE_CYCLES"] = "4"
        os.environ["REDUNDANCY_THRESHOLD"] = "0.70"
        os.environ["FORCE_FINAL_SYNTHESIS"] = "0"

        orchestrator = ResponseOrchestrator(llm_adapter=_DummyLLMAdapter())  # type: ignore[arg-type]

        request = OrchestrationRequest(
            request_id="trace-min-cycles",
            mode="chat",
            user_id="user-min",
            prompt_original="Analise curta com repeticao intencional.",
            objective_current="Analise curta",
            context_payload={"context": "basico"},
            max_tokens=512,
            temperature=0.2,
            top_p=0.9,
            prefer_multi_pass=True,
            max_cycles_override=4,
            min_cycles_override=4,
            planner_hints=["etapa 1", "etapa 2", "etapa 3", "etapa 4"],
            single_pass_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text="Fallback single pass.",
            ),
            cycle_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text="Bloco repetido: mesmo conteudo para testar controle de redundancia.",
            ),
        )
        result = orchestrator.orchestrate(request=request)

        self.assertGreaterEqual(result.cycle_count, 4)
        self.assertIn(result.stop_reason, {"coverage_reached", "max_cycles_reached", "semantic_stagnation"})
        self.assertFalse(result.fallback_used)

    def test_phase0_segmented_two_call_paragraph(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["CHAT_SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["PHASE0_SEGMENTED_EMISSION_ENABLED"] = "1"
        os.environ["PHASE0_CHAT_SEGMENTED_EMISSION_ENABLED"] = "1"
        os.environ["PHASE0_SEGMENTED_EMISSION_AUTO_ENABLED"] = "0"
        os.environ["PHASE0_FIRST_CHUNK_MIN_TOKENS"] = "120"
        os.environ["PHASE0_FIRST_CHUNK_TARGET_TOKENS"] = "150"
        os.environ["PHASE0_FIRST_CHUNK_MAX_TOKENS"] = "180"
        os.environ["PHASE0_PER_CALL_MAX_TOKENS"] = "180"
        os.environ["FORCE_FINAL_SYNTHESIS"] = "0"

        orchestrator = ResponseOrchestrator(llm_adapter=_DummyLLMAdapter())  # type: ignore[arg-type]

        def cycle_generator(gen_req):
            if int(gen_req.cycle_index) == 1:
                return self._engine_response(
                    trace_id=gen_req.trace_id,
                    text="A estabilidade de inferencia degrada com aumento de carga.",
                )
            return self._engine_response(
                trace_id=gen_req.trace_id,
                text=(
                    "sobretudo quando a fila de requisicoes cresce de forma desigual, "
                    "o throughput oscila e o timeout torna-se mais frequente."
                ),
            )

        request = OrchestrationRequest(
            request_id="trace-phase0-two-call",
            mode="chat",
            user_id="user-phase0",
            prompt_original=(
                "Explique a estabilidade do vLLM em um paragrafo tecnico medio, "
                "com continuidade e fechamento natural."
            ),
            objective_current="Paragrafo tecnico unico sobre estabilidade do vLLM",
            context_payload={"context": "fase0"},
            max_tokens=768,
            temperature=0.2,
            top_p=0.9,
            prefer_multi_pass=True,
            max_cycles_override=6,
            min_cycles_override=6,
            single_pass_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text="Fallback single pass.",
            ),
            cycle_generator=cycle_generator,
            metadata={
                "phase0_segmented_emission": True,
                "phase0_preferred_connector": "sobretudo quando",
            },
        )
        result = orchestrator.orchestrate(request=request)

        self.assertEqual(result.response_mode, "multi_pass")
        self.assertEqual(result.cycle_count, 2)
        self.assertIn("sugestao de melhoria", result.response_text.lower())
        self.assertIn("voce quer que eu aplique essas melhorias agora?", result.response_text.lower())
        self.assertIn("sobretudo quando", result.response_text.lower())
        self.assertTrue(bool(result.telemetry["plan"]["phase0"]["enabled"]))
        self.assertEqual(int(result.telemetry["plan"]["phase0"]["call_count"]), 2)

    def test_partial_response_preserved_on_cycle_failure(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["CHAT_SECONDARY_PROCESS_MEMORY_ENABLED"] = "1"
        os.environ["RESPONSE_ORCHESTRATION_MAX_CYCLES"] = "3"
        os.environ["CHAT_MAX_RESPONSE_CYCLES"] = "3"
        os.environ["FORCE_FINAL_SYNTHESIS"] = "0"

        orchestrator = ResponseOrchestrator(llm_adapter=_DummyLLMAdapter())  # type: ignore[arg-type]

        def cycle_generator(gen_req):
            if int(gen_req.cycle_index) == 1:
                return self._engine_response(
                    trace_id=gen_req.trace_id,
                    text="Bloco 1: continuidade inicial com base no contexto principal.",
                )
            raise RuntimeError("simulated_cycle_failure")

        request = OrchestrationRequest(
            request_id="trace-failure",
            mode="chat",
            user_id="user-3",
            prompt_original="Analise profunda e detalhada com varios blocos.",
            objective_current="Analise profunda",
            context_payload={"context": "amplo"},
            max_tokens=512,
            temperature=0.2,
            top_p=0.9,
            prefer_multi_pass=True,
            planner_hints=["etapa 1", "etapa 2", "etapa 3"],
            single_pass_generator=lambda gen_req: self._engine_response(
                trace_id=gen_req.trace_id,
                text="Fallback single pass final.",
            ),
            cycle_generator=cycle_generator,
        )
        result = orchestrator.orchestrate(request=request)

        self.assertEqual(result.stop_reason, "cycle_error_partial")
        self.assertIn("bloco 1", result.response_text.lower())
        self.assertFalse(result.fallback_used)

    def test_secondary_memory_cleanup_expired_sessions(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_TTL_SECONDS"] = "120"
        service = SecondaryProcessMemoryService()
        request = OrchestrationRequest(
            request_id="trace-cleanup",
            mode="chat",
            user_id="user-cleanup",
            prompt_original="Prompt",
            objective_current="Objetivo",
            context_payload={},
            max_tokens=128,
            temperature=0.2,
            top_p=0.9,
        )
        plan = EmissionPlan(
            response_mode="single_pass",
            should_use_multi_pass=False,
            complexity_score=0.1,
            planned_sections=["resposta principal"],
            max_cycles=1,
            target_chunk_tokens=128,
            max_total_response_tokens=256,
        )
        state = service.start_session(request=request, plan=plan, trace_id="trace-cleanup")
        state.expires_at = "2000-01-01T00:00:00+00:00"
        service._sessions[state.session_id] = state  # type: ignore[attr-defined]
        removed = service.cleanup_expired()

        self.assertEqual(removed, 1)
        self.assertIsNone(service.get_session(session_id=state.session_id))

    def test_secondary_memory_continues_across_calls_same_scope(self) -> None:
        os.environ["SECONDARY_PROCESS_MEMORY_CROSS_CALL_ENABLED"] = "1"
        os.environ["WRITE_SECONDARY_PROCESS_MEMORY_CROSS_CALL_ENABLED"] = "1"

        service = SecondaryProcessMemoryService()
        plan = EmissionPlan(
            response_mode="multi_pass",
            should_use_multi_pass=True,
            complexity_score=1.6,
            planned_sections=["contexto", "analise", "sintese"],
            max_cycles=3,
            target_chunk_tokens=180,
            max_total_response_tokens=900,
        )
        req1 = OrchestrationRequest(
            request_id="trace-seed-1",
            mode="write",
            user_id="user-seed",
            project_id="project-seed",
            thread_id="section-seed",
            prompt_original="Primeira chamada",
            objective_current="Primeira chamada",
            context_payload={},
            max_tokens=256,
            temperature=0.2,
            top_p=0.9,
            locked_terminology=["Termo A"],
            constraints=["constraint:a"],
            tone_hint="formal",
        )
        state1 = service.start_session(request=req1, plan=plan, trace_id="trace-seed-1")
        state1.key_claims_established = ["claim:escopo", "claim:metodo"]
        state1.forbidden_repetitions = ["resumo antigo"]
        state1.open_loops = ["loop pendente"]
        state1.continuity_bridge = "ponte anterior"
        state1.chunk_summaries = ["resumo 1", "resumo 2"]
        state1 = service.save_session(state=state1)
        service.finalize_session(session_id=state1.session_id, stop_reason="completed", trace_id="trace-seed-1")

        req2 = OrchestrationRequest(
            request_id="trace-seed-2",
            mode="write",
            user_id="user-seed",
            project_id="project-seed",
            thread_id="section-seed",
            prompt_original="Segunda chamada",
            objective_current="Segunda chamada",
            context_payload={},
            max_tokens=256,
            temperature=0.2,
            top_p=0.9,
            locked_terminology=["Termo B"],
            constraints=["constraint:b"],
            tone_hint="",
        )
        state2 = service.start_session(request=req2, plan=plan, trace_id="trace-seed-2")

        self.assertEqual(state2.continued_from_session_id, state1.session_id)
        self.assertIn("claim:escopo", state2.key_claims_established)
        self.assertIn("resumo antigo", state2.forbidden_repetitions)
        self.assertIn("loop pendente", state2.open_loops)
        self.assertEqual(state2.continuity_bridge, "ponte anterior")
        self.assertIn("constraint:a", state2.constraints_active)
        self.assertIn("constraint:b", state2.constraints_active)
        self.assertIn("Termo A", state2.terminology_locked)
        self.assertIn("Termo B", state2.terminology_locked)
        self.assertEqual(state2.tone_locked, "formal")
        self.assertEqual(state2.partial_chunks, [])
        self.assertEqual(state2.cycle_count, 0)


if __name__ == "__main__":
    unittest.main()
