import unittest

from anm_backend.services.response_orchestration.final_response_policy_service import FinalResponsePolicyService


class FinalResponsePolicyTests(unittest.TestCase):
    def test_merges_fragmented_short_output_and_adds_followup(self) -> None:
        service = FinalResponsePolicyService()
        prompt = "Explique por que a resposta fica fragmentada."
        fragmented = "Isso acontece por excesso de tokens.\nO sistema fragmenta.\nA resposta fica lenta."

        result = service.apply(prompt_original=prompt, response_text=fragmented)

        self.assertTrue(bool(result.merged_into_single_paragraph))
        self.assertNotIn("\n\n", result.main_text)
        self.assertIn("sugestao de melhoria", result.final_text.lower())
        self.assertIn("voce quer que eu aplique essas melhorias agora?", result.final_text.lower())

    def test_preserves_structured_list_when_requested(self) -> None:
        service = FinalResponsePolicyService()
        prompt = "Liste passo a passo como corrigir isso."
        listed = "1. Verifique o endpoint.\n2. Ajuste timeout e retries.\n3. Valide com teste de carga."

        result = service.apply(prompt_original=prompt, response_text=listed)

        self.assertIn("1.", result.main_text)
        self.assertIn("2.", result.main_text)
        self.assertIn("3.", result.main_text)
        self.assertIn("sugestao de melhoria", result.final_text.lower())
        self.assertIn("voce quer que eu aplique essas melhorias agora?", result.final_text.lower())


if __name__ == "__main__":
    unittest.main()
