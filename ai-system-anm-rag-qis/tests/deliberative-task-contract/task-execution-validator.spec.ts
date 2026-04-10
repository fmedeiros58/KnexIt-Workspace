import { taskObligationExtractor } from "../../src/05b-deliberative-task-contract-layer/task-obligation-extractor";
import { validateTaskExecution } from "../../src/05b-deliberative-task-contract-layer/task-execution-validator";

describe("task execution validator", () => {
  const prompt = `
  (a) demonstre formalmente por que ha conflito;
  (b) proponha dois modelos;
  (c) escolha um modelo e justifique;
  (d) faca objecao forte;
  (e) explicite pressupostos.
  `;

  it("falha quando ha apenas declaracoes genericas", () => {
    const obligations = taskObligationExtractor(prompt);
    const weak = "Ha conflitos e depende do contexto. Existem alternativas, mas tudo depende.";
    const result = validateTaskExecution(obligations, weak);

    expect(result.passed).toBe(false);
    expect(result.unexecutedObligations.length).toBeGreaterThan(0);
  });

  it("passa quando executa operacoes pedidas", () => {
    const obligations = taskObligationExtractor(prompt);
    const strong = [
      "Demonstracao formal: defino variaveis, assumo um estado factivel com restricoes e mostro por derivacao que nem toda decisao satisfaz simultaneamente todos os criterios; logo ha conflito.",
      "Proponho dois modelos com alternativas viaveis e mecanismo operacional explicito: Modelo 1 (prioridade lexico-risco) e Modelo 2 (utilidade esperada com piso de equidade).",
      "Decisao: escolho o Modelo 2 com criterio de escolha, justificativa da priorizacao e avaliacao de trade-off.",
      "Objecao steelman: mesmo escolhido, o modelo pode gerar custo moral e risco institucional por arbitrariedade na calibracao.",
      "Pressupostos nao provados: mensurabilidade parcial de risco, comparabilidade entre beneficios e estabilidade institucional.",
    ].join("\n\n");
    const result = validateTaskExecution(obligations, strong);

    expect(result.passed).toBe(true);
    expect(result.executionScore).toBeGreaterThanOrEqual(0.8);
  });
});
