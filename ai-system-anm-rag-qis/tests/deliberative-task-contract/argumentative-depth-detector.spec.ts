import { argumentativeDepthDetector } from "../../src/05b-deliberative-task-contract-layer/argumentative-depth-detector";

describe("argumentativeDepthDetector", () => {
  it("ativa contrato deliberativo para prompt multiobrigacional formal", () => {
    const prompt =
      "Sem recorrer a autores, demonstre formalmente o conflito, proponha dois modelos, construa a melhor objecao e explicite pressupostos nao provados.";

    const result = argumentativeDepthDetector(prompt);

    expect(result.requiresDeliberativeContract).toBe(true);
    expect(result.argumentativeDepthScore).toBeGreaterThanOrEqual(0.45);
    expect(result.needsFormalization).toBe(true);
    expect(result.needsCounterObjection).toBe(true);
    expect(result.needsAssumptionAudit).toBe(true);
  });
});
