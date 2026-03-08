import unittest

from anm_backend.services.cognitive_service import (
    _build_chat_planner_hints,
    _classify_prompt_complexity,
    _resolve_chat_multi_pass_directives,
    _resolve_generation_profile,
)


class CognitiveServiceProfileTests(unittest.TestCase):
    def test_brief_depth_question_promotes_to_medium(self) -> None:
        prompt = "Quais as consequencias do colesterol alto?"
        complexity = _classify_prompt_complexity(prompt)
        profile = _resolve_generation_profile(prompt)

        self.assertEqual(complexity, "medium")
        self.assertGreaterEqual(int(profile["max_tokens"]), 1024)
        self.assertNotIn("2 frases", str(profile["style_hint"]).lower())

    def test_very_short_prompt_uses_short_mode(self) -> None:
        prompt = "Python?"
        complexity = _classify_prompt_complexity(prompt)
        profile = _resolve_generation_profile(prompt)

        self.assertEqual(complexity, "short")
        self.assertLessEqual(int(profile["max_tokens"]), 1024)

    def test_strict_directive_is_preserved(self) -> None:
        prompt = "traduza casa para ingles"
        complexity = _classify_prompt_complexity(prompt)
        profile = _resolve_generation_profile(prompt)

        self.assertEqual(complexity, "strict")
        self.assertIn("modo estrito", str(profile["style_hint"]).lower())

    def test_adaptive_multi_pass_directives_are_disabled_for_direct_mode(self) -> None:
        directives = _resolve_chat_multi_pass_directives(complexity="direct")
        self.assertFalse(bool(directives["prefer_multi_pass"]))
        self.assertEqual(int(directives["min_cycles"]), 1)
        self.assertEqual(int(directives["max_cycles"]), 1)

    def test_adaptive_multi_pass_directives_scale_for_medium_mode(self) -> None:
        directives = _resolve_chat_multi_pass_directives(
            complexity="medium",
            prompt="Explique colesterol alto, causas, riscos, exames e como reduzir com orientacoes praticas.",
        )
        self.assertTrue(bool(directives["prefer_multi_pass"]))
        self.assertGreaterEqual(int(directives["min_cycles"]), 4)
        self.assertGreaterEqual(int(directives["max_cycles"]), int(directives["min_cycles"]))

    def test_medium_cycles_vary_with_prompt_depth(self) -> None:
        shallow = _resolve_chat_multi_pass_directives(
            complexity="medium",
            prompt="Explique colesterol.",
        )
        deep = _resolve_chat_multi_pass_directives(
            complexity="medium",
            prompt=(
                "Explique em detalhes as consequencias do colesterol alto, causas, fatores de risco, "
                "exames de acompanhamento, condutas de tratamento e prevencao, comparando cenarios clinicos."
            ),
        )
        self.assertGreaterEqual(int(deep["min_cycles"]), int(shallow["min_cycles"]))

    def test_planner_hints_expand_to_target_cycles(self) -> None:
        hints = _build_chat_planner_hints(
            prompt="Explique o tema em profundidade com implicacoes praticas.",
            collapsed_summary="Hipotese central",
            cycles=6,
        )
        self.assertEqual(len(hints), 6)
        self.assertTrue(any("sintese" in item.lower() for item in hints))


if __name__ == "__main__":
    unittest.main()
