import { classifyCognitiveDemand } from "../../src/05b-deliberative-task-contract-layer/cognitive-demand-classifier";
import { taskObligationExtractor } from "../../src/05b-deliberative-task-contract-layer/task-obligation-extractor";

describe("generalized deliberative demand", () => {
  const families = [
    {
      name: "comparacao_simples",
      prompt: "Qual abordagem e melhor para reduzir custo sem perder robustez e por que?",
      expectDeliberative: true,
    },
    {
      name: "diagnostico",
      prompt: "Meu sistema esta respondendo rapido, mas superficialmente. Onde esta a falha e como corrigir?",
      expectDeliberative: true,
    },
    {
      name: "planejamento",
      prompt: "Como organizar um pipeline para priorizar precisao sem sacrificar latencia?",
      expectDeliberative: true,
    },
    {
      name: "linguagem_comum_profunda",
      prompt: "Isso parece certo, mas por que sinto que tem algo errado nessa ideia?",
      expectDeliberative: false,
    },
    {
      name: "small_talk",
      prompt: "oi, tudo bem?",
      expectDeliberative: false,
    },
  ];

  it("generaliza por familias funcionais e nao por prompt unico", () => {
    for (const family of families) {
      const profile = classifyCognitiveDemand(family.prompt);
      const obligations = taskObligationExtractor(family.prompt);

      if (family.expectDeliberative) {
        expect(profile.requiresDeliberativeContract).toBe(true);
        expect(profile.taskArchetypes.length).toBeGreaterThan(0);
        expect(obligations.length).toBeGreaterThanOrEqual(1);
      } else {
        expect(profile.reasoningIntensity).toBeLessThan(0.62);
      }
    }
  });
});
