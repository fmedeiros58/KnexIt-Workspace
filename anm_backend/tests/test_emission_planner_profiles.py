import os
import unittest

from anm_backend.services.response_orchestration.emission_planner_service import EmissionPlannerService
from anm_backend.services.response_orchestration.types import OrchestrationRequest


class EmissionPlannerProfilesTests(unittest.TestCase):
    _ENV_KEYS = [
        "RESPONSE_ORCHESTRATION_MAX_CYCLES",
        "CHAT_MAX_RESPONSE_CYCLES",
        "RESPONSE_ORCHESTRATION_DEEP_MODE_ENABLED",
    ]

    def setUp(self) -> None:
        self._env_snapshot = {key: os.environ.get(key) for key in self._ENV_KEYS}
        os.environ["RESPONSE_ORCHESTRATION_MAX_CYCLES"] = "10"
        os.environ["CHAT_MAX_RESPONSE_CYCLES"] = "10"

    def tearDown(self) -> None:
        for key, value in self._env_snapshot.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def _request(self, *, prompt: str, prefer_multi_pass: bool = True) -> OrchestrationRequest:
        return OrchestrationRequest(
            request_id="trace-plan",
            mode="chat",
            user_id="user-plan",
            prompt_original=prompt,
            objective_current=prompt,
            context_payload={"ctx": "baseline"},
            max_tokens=1024,
            temperature=0.2,
            top_p=0.9,
            prefer_multi_pass=prefer_multi_pass,
        )

    def test_default_profile_uses_four_calls(self) -> None:
        planner = EmissionPlannerService()
        request = self._request(prompt="Explique o tema de forma objetiva.", prefer_multi_pass=True)

        plan = planner.plan(request=request, orchestration_enabled=True)

        self.assertEqual(plan.response_mode, "multi_pass")
        self.assertEqual(int(plan.min_cycles_required), 4)
        self.assertEqual(int(plan.max_cycles), 4)
        self.assertTrue(any("call_profile:default" in item for item in plan.rationale))

    def test_robust_profile_uses_six_calls(self) -> None:
        planner = EmissionPlannerService()
        request = self._request(
            prompt=(
                "Analise em detalhes a arquitetura do pipeline, compare metodologias, "
                "explique passo a passo os trade-offs, estruture criterios de decisao, "
                "e consolide uma estrategia de implementacao com riscos e limites."
            ),
            prefer_multi_pass=True,
        )

        plan = planner.plan(request=request, orchestration_enabled=True)

        self.assertEqual(plan.response_mode, "multi_pass")
        self.assertEqual(int(plan.min_cycles_required), 6)
        self.assertEqual(int(plan.max_cycles), 6)
        self.assertTrue(any("call_profile:robust" in item for item in plan.rationale))

    def test_deep_profile_uses_ten_calls_when_enabled(self) -> None:
        os.environ["RESPONSE_ORCHESTRATION_DEEP_MODE_ENABLED"] = "1"
        planner = EmissionPlannerService()
        request = self._request(
            prompt=(
                "Analise em detalhes a arquitetura do pipeline, compare metodologias, "
                "explique passo a passo os trade-offs, estruture criterios de decisao, "
                "e consolide uma estrategia de implementacao com riscos, limites e mitigacoes. "
                "Tambem detalhe como o fluxo deve evoluir entre chamadas, como reduzir redundancia, "
                "como preservar coerencia semantica e como garantir fechamento textual com monitoramento de latencia, "
                "erros e estabilidade operacional em cenarios de carga alta."
            ),
            prefer_multi_pass=True,
        )

        plan = planner.plan(request=request, orchestration_enabled=True)

        self.assertEqual(plan.response_mode, "multi_pass")
        self.assertEqual(int(plan.min_cycles_required), 10)
        self.assertEqual(int(plan.max_cycles), 10)
        self.assertTrue(any("call_profile:deep" in item for item in plan.rationale))


if __name__ == "__main__":
    unittest.main()
