import unittest

from anm_backend.adapters.llm_adapter import LLMAdapter
from anm_backend.adapters.prompt_builder import PromptBuilder
from anm_backend.adapters.response_parser import ResponseParser
from anm_backend.contracts import EngineRequest
from anm_backend.orchestrator.hypothesis_pool import Hypothesis


class FakeEngineClient:
    model_name = "fake-model"
    base_url = "http://fake"
    last_payload = None

    def build_request(self, **kwargs):
        return EngineRequest(
            trace_id=kwargs.get("trace_id", "trace-fake"),
            messages=kwargs["messages"],
            model=self.model_name,
            max_tokens=kwargs.get("max_tokens", 128),
            temperature=0.3,
            top_p=0.9,
            metadata=dict(kwargs.get("metadata", {})),
        )

    def engine_request_to_payload(self, request: EngineRequest):
        payload = {
            "model": request.model,
            "messages": request.messages,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "stream": False,
        }
        if request.metadata:
            payload["metadata"] = dict(request.metadata)
        return payload

    def invoke(self, payload, *, trace_id: str):
        self.last_payload = dict(payload)
        return {
            "model": payload.get("model", self.model_name),
            "choices": [{"message": {"content": "ok"}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 1},
        }


class AdapterTests(unittest.TestCase):
    def test_prompt_builder(self) -> None:
        builder = PromptBuilder()
        messages = builder.build_messages(
            user_input="teste",
            context={"working": [{"text": "a"}], "global_semantic": {}, "activation_map": {}, "regulatory": {}},
            hypotheses=[Hypothesis("h1", "conteudo", 0.8, 0.7, 0.2, 0.9, "n1", stimulus_coherence=0.8)],
            readiness_state="STABLE",
        )
        self.assertGreaterEqual(len(messages), 1)
        self.assertIn("Contexto vivo", messages[-1]["content"])

    def test_prompt_builder_has_generic_fallback_when_ram_context_is_low(self) -> None:
        builder = PromptBuilder()
        messages = builder.build_messages(
            user_input="Quais as consequencias do colesterol alto?",
            context={"working": [], "global_semantic": {}, "activation_map": {}, "regulatory": {}},
            hypotheses=[],
            readiness_state="OPEN",
        )
        payload = "\n".join(item["content"] for item in messages).lower()
        self.assertIn("conhecimento geral confiavel", payload)
        self.assertIn("evite respostas do tipo 'sem base suficiente no contexto'", payload)
        self.assertIn("suficiencia de contexto ram: baixa", payload)

    def test_prompt_builder_includes_structure_and_followup_instruction(self) -> None:
        builder = PromptBuilder()
        messages = builder.build_messages(
            user_input="explique cache distribuido",
            context={"working": [{"text": "ctx"}], "global_semantic": {}, "activation_map": {}, "regulatory": {}},
            hypotheses=[Hypothesis("h1", "conteudo", 0.8, 0.7, 0.2, 0.9, "n1", stimulus_coherence=0.8)],
            readiness_state="STABLE",
            response_plan={"target_tokens": 180},
            include_followup_prompt=True,
        )
        payload = "\n".join(item["content"] for item in messages)
        self.assertIn("inicio, meio e fim", payload.lower())
        self.assertIn("180 tokens", payload.lower())
        self.assertIn("pergunta objetiva", payload.lower())

    def test_llm_adapter_call(self) -> None:
        fake_engine = FakeEngineClient()
        adapter = LLMAdapter(
            engine_client=fake_engine,  # type: ignore[arg-type]
            prompt_builder=PromptBuilder(),
            response_parser=ResponseParser(),
        )
        response = adapter.infer(
            user_input="oi",
            context={"working": [], "global_semantic": {}, "activation_map": {}, "regulatory": {}},
            hypotheses=[],
            readiness_state="OPEN",
        )
        self.assertEqual(response.text, "ok")
        metadata = dict((fake_engine.last_payload or {}).get("metadata", {}))
        self.assertIn("anm_token_plan", metadata)
        self.assertIn("anm_response_strategy", metadata)

    def test_llm_adapter_respects_explicit_size_request(self) -> None:
        fake_engine = FakeEngineClient()
        adapter = LLMAdapter(
            engine_client=fake_engine,  # type: ignore[arg-type]
            prompt_builder=PromptBuilder(),
            response_parser=ResponseParser(),
        )
        adapter.infer(
            user_input="explique o tema em 40 palavras",
            context={"working": [], "global_semantic": {}, "activation_map": {}, "regulatory": {}},
            hypotheses=[],
            readiness_state="OPEN",
            max_tokens=512,
            include_followup_prompt=True,
        )
        sent_max_tokens = int((fake_engine.last_payload or {}).get("max_tokens", 0))
        metadata = dict((fake_engine.last_payload or {}).get("metadata", {}))
        plan = dict(metadata.get("anm_token_plan", {}))
        self.assertGreater(sent_max_tokens, 0)
        self.assertEqual(sent_max_tokens, int(plan.get("target_output_tokens", sent_max_tokens)))
        self.assertLessEqual(sent_max_tokens, 80)

    def test_llm_adapter_does_not_cap_for_closing_summary_clause(self) -> None:
        fake_engine = FakeEngineClient()
        adapter = LLMAdapter(
            engine_client=fake_engine,  # type: ignore[arg-type]
            prompt_builder=PromptBuilder(),
            response_parser=ResponseParser(),
        )
        adapter.infer(
            user_input=(
                "Explique em profundidade como melhorar a estabilidade de inferencia no backend, "
                "inclua diagnostico, estrategia de mitigacao, pontos de monitoramento e tradeoffs, "
                "e finalize com uma sintese de 1 frase."
            ),
            context={"working": [], "global_semantic": {}, "activation_map": {}, "regulatory": {}},
            hypotheses=[],
            readiness_state="OPEN",
            max_tokens=512,
            include_followup_prompt=True,
        )
        sent_max_tokens = int((fake_engine.last_payload or {}).get("max_tokens", 0))
        metadata = dict((fake_engine.last_payload or {}).get("metadata", {}))
        plan = dict(metadata.get("anm_token_plan", {}))
        self.assertGreaterEqual(sent_max_tokens, 256)
        self.assertEqual(sent_max_tokens, int(plan.get("target_output_tokens", sent_max_tokens)))

    def test_extract_requested_output_tokens_ignores_closing_summary_phrase(self) -> None:
        adapter = LLMAdapter(
            engine_client=FakeEngineClient(),  # type: ignore[arg-type]
            prompt_builder=PromptBuilder(),
            response_parser=ResponseParser(),
        )
        explicit = adapter._extract_requested_output_tokens("resuma em 1 frase")
        closing = adapter._extract_requested_output_tokens(
            "Explique em detalhes o tema e finalize com uma sintese de 1 frase."
        )
        self.assertEqual(explicit, 32)
        self.assertIsNone(closing)


if __name__ == "__main__":
    unittest.main()
