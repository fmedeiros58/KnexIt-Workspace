import { validateDemonstrationSufficiency } from "../../src/05b-deliberative-task-contract-layer/demonstration-sufficiency-validator";
import { detectAssertionVsProofGap } from "../../src/05b-deliberative-task-contract-layer/assertion-vs-proof-detector";

describe("demonstration validators", () => {
  const pseudoProof =
    "Ha contextos em que qualquer decisao viola um principio. Logo, o conflito e estrutural e portanto inevitavel.";

  const structuredProof = [
    "Definicoes: p1, p2 e p3 sao predicados normativos obrigatorios.",
    "Hipotese: considere um estado s com escassez e externalidades que impem restricoes simultaneas.",
    "Se toda decisao factivel em s precisa reduzir ao menos um predicado, entao nao existe decisao que satisfaca p1, p2 e p3 ao mesmo tempo.",
    "Portanto, nesse estado, a conjuncao e insatisfativel sem contradicao logica estrita entre os principios em abstrato.",
  ].join(" ");

  it("detecta pseudo-prova sem cadeia inferencial suficiente", () => {
    const pseudoDemoReport = validateDemonstrationSufficiency(pseudoProof);
    const pseudoAssertionGap = detectAssertionVsProofGap(pseudoProof);

    expect(pseudoDemoReport.passed).toBe(false);
    expect(pseudoAssertionGap.passed).toBe(false);
  });

  it("aprova prova estruturada com derivacao explicita", () => {
    const structuredDemoReport = validateDemonstrationSufficiency(structuredProof);
    const structuredAssertionGap = detectAssertionVsProofGap(structuredProof);

    expect(structuredDemoReport.passed).toBe(true);
    expect(structuredAssertionGap.passed).toBe(true);
  });

  it("reprova resposta que reabre enunciado e corta antes da derivacao", () => {
    const replayedAndCut =
      "Consideremos um sistema social idealizado com tres principios normativos obrigatorios. Faremos o seguinte: demonstraremos formalmente por que o conflito e inevitavel. Primeiro, let's demonstrate why the conflict between";
    const report = detectAssertionVsProofGap(replayedAndCut);
    expect(report.passed).toBe(false);
    expect(report.issues).toContain("prompt_replay_instead_of_demonstration");
    expect(report.issues).toContain("truncated_or_open_ending_detected");
  });
});
