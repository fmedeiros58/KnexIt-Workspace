import unittest

from anm_backend.adapters.llm_adapter import LLMAdapter
from anm_backend.adapters.prompt_builder import PromptBuilder
from anm_backend.adapters.response_parser import ResponseParser
from anm_backend.contracts import EngineRequest
from anm_backend.orchestrator.hypothesis_pool import Hypothesis


class FakeEngineClient:
    model_name = "fake-model"
    base_url = "http://fake"

    def build_request(self, **kwargs):
        return EngineRequest(
            trace_id=kwargs.get("trace_id", "trace-fake"),
            messages=kwargs["messages"],
            model=self.model_name,
            max_tokens=kwargs.get("max_tokens", 128),
            temperature=0.3,
            top_p=0.9,
        )

    def engine_request_to_payload(self, request: EngineRequest):
        return {
            "model": request.model,
            "messages": request.messages,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "stream": False,
        }

    def invoke(self, payload, *, trace_id: str):
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

    def test_llm_adapter_call(self) -> None:
        adapter = LLMAdapter(
            engine_client=FakeEngineClient(),  # type: ignore[arg-type]
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


if __name__ == "__main__":
    unittest.main()
