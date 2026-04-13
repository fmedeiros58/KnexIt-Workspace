import {
  detectPromptConstraints,
  enforcePromptConstraints,
} from "../../src/05b-deliberative-task-contract-layer/instruction-constraint-enforcer";

describe("instruction constraint enforcer", () => {
  it("detecta restricoes metodologicas explicitas", () => {
    const prompt =
      "Sem recorrer inicialmente a autores, teorias e exemplos historicos. Responda item por item e explicite pressupostos ao final.";
    const constraints = detectPromptConstraints(prompt);
    expect(constraints.length).toBeGreaterThanOrEqual(4);
    expect(constraints.some((item) => item.type === "no_authors")).toBe(true);
    expect(constraints.some((item) => item.type === "item_by_item_execution")).toBe(true);
  });

  it("marca violacao quando usa exemplo concreto no inicio", () => {
    const prompt = "Sem exemplos concretos iniciais e sem recorrer a autores.";
    const response =
      "Por exemplo, uma lei de proibicao pode resolver parte do problema. Segundo Rawls, isso pode ser avaliado.";
    const result = enforcePromptConstraints(prompt, response);
    expect(result.passed).toBe(false);
    expect(result.violations.some((item) => item.includes("no_concrete_examples_initially"))).toBe(true);
    expect(result.violations.some((item) => item.includes("no_authors"))).toBe(true);
  });
});

