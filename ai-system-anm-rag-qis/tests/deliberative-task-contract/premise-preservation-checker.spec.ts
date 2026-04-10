import { checkPremisePreservation } from "../../src/05b-deliberative-task-contract-layer/premise-preservation-checker";

describe("premise preservation checker", () => {
  it("detecta rebaixamento indevido de premissa forte", () => {
    const prompt =
      "(1) nenhuma decisao coletiva pode reduzir a liberdade basica de um individuo inocente; (2) toda decisao deve maximizar o bem-estar agregado.";
    const response =
      "A liberdade basica e apenas uma preferencia relativa e depende da perspectiva adotada.";
    const result = checkPremisePreservation(prompt, response);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

