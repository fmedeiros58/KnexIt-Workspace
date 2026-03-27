import test from "node:test";
import assert from "node:assert/strict";
import { synthesizeObjectiveAnswer } from "../src/10-reflective-layer/reflective-core/objective-rationality-core/objective-rationality-bridge";

test("selects dominant option and starts with objective conclusion", () => {
  const result = synthesizeObjectiveAnswer({
    query:
      "o que e melhor para uma familia faminta de 20 pessoas, 1 kg de carne e 1 kg de arroz, ou 5 kg de carne e 5 kg de arroz? quero sua opiniao curta e grossa, sem avaliar precos, apenas o que e melhor em absoluto",
    options: ["1 kg de carne e 1 kg de arroz", "5 kg de carne e 5 kg de arroz"],
  });

  assert.equal(result.evaluation.directJudgment.detected, true);
  assert.equal(result.evaluation.dominance.kind, "strict_dominance");
  assert.equal(result.finalAnswer, "5 kg de carne e 5 kg de arroz. Ela entrega objetivamente mais recursos para o objetivo apresentado.");
});

test("suppresses hedging in direct objective mode when no options are available", () => {
  const result = synthesizeObjectiveAnswer({
    query: "resposta direta, sem relativizar e sem depender",
    draftAnswer: "A melhor opcao e 5 kg de carne e 5 kg de arroz, depende do contexto.",
  });

  assert.equal(result.evaluation.shouldSuppressHedging, true);
  assert.ok(result.finalAnswer?.includes("5 kg de carne e 5 kg de arroz"));
  assert.equal(result.finalAnswer?.includes("depende"), false);
  assert.equal(result.finalAnswer?.includes("por outro lado"), false);
});
