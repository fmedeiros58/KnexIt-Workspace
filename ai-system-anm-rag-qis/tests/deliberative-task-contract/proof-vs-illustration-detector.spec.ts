import { detectProofVsIllustration } from "../../src/05b-deliberative-task-contract-layer/proof-vs-illustration-detector";

describe("proof vs illustration detector", () => {
  it("falha quando demonstracao e substituida por exemplo", () => {
    const response =
      "Por exemplo, uma lei qualquer pode reduzir riscos. Isso mostra que o conflito existe.";
    const result = detectProofVsIllustration(response, { requiresDemonstration: true });
    expect(result.passed).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("passa quando ha cadeia inferencial minima", () => {
    const response =
      "Se D e o conjunto de decisoes e se cada d em D satisfaz no maximo dois criterios, entao a conjuncao completa e insatisfazivel. Logo, nao existe decisao que maximize todos os criterios simultaneamente.";
    const result = detectProofVsIllustration(response, { requiresDemonstration: true });
    expect(result.passed).toBe(true);
  });

  it("falha quando resposta so repete o enunciado com estrutura de passos", () => {
    const response =
      "Consideremos um sistema social idealizado com tres principios. Faremos o seguinte: (a) demonstrar formalmente; (b) propor modelos; (c) mostrar custos.";
    const result = detectProofVsIllustration(response, { requiresDemonstration: true });
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("prompt_replay_detected_in_demonstration_section");
  });
});
