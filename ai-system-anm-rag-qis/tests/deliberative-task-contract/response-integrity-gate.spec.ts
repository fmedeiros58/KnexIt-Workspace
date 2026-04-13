import { checkResponseIntegrity } from "../../src/05b-deliberative-task-contract-layer/response-integrity-gate";

describe("response integrity gate", () => {
  it("bloqueia resposta truncada", () => {
    const response = "Modelo 1: negociacao consensual. Modelo 2:";
    const result = checkResponseIntegrity({
      responseText: response,
      expectedObligations: 5,
      satisfiedObligations: 2,
    });
    expect(result.passed).toBe(false);
    expect(result.isTruncated).toBe(true);
  });

  it("bloqueia corte por palavra incompleta no final", () => {
    const response =
      "A analise compara criterios concorrentes e explicita os custos logicos e institucionais, mas a parte final ficou em dific";
    const result = checkResponseIntegrity({
      responseText: response,
      expectedObligations: 4,
      satisfiedObligations: 3,
    });
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("abrupt_or_open_ending");
  });

  it("bloqueia texto com caractere de substituicao", () => {
    const response = "Considerando tr�s princ�pios normativos, segue a analise.";
    const result = checkResponseIntegrity({
      responseText: response,
      expectedObligations: 2,
      satisfiedObligations: 2,
    });
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("replacement_char_detected");
  });

  it("bloqueia texto com superficie de mojibake recorrente", () => {
    const response =
      "Consideremos um sistema social idealizado com trÃªs princÃ­pios normativos obrigatÃ³rios e conclusÃ£o truncada";
    const result = checkResponseIntegrity({
      responseText: response,
      expectedObligations: 3,
      satisfiedObligations: 1,
    });
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("mojibake_surface_detected");
  });
});
