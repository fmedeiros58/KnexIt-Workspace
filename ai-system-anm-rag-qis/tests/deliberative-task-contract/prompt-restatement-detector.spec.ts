import { detectPromptRestatement } from "../../src/05b-deliberative-task-contract-layer/prompt-restatement-detector";

describe("prompt restatement detector", () => {
  it("detecta eco estrutural do enunciado", () => {
    const prompt =
      "Choose one plan among A, B, and C and do (a) formulate, (b) demonstrate, (c) propose two models, (d) compare costs, (e) choose, (f) objection, (g) reformulate, (h) assumptions.";
    const mirrored =
      "Choose one plan among A, B, and C and do (a) formulate, (b) demonstrate, (c) propose two models, (d) compare costs, (e) choose, (f) objection, (g) reformulate, (h) assumptions.";

    const result = detectPromptRestatement(prompt, mirrored);
    expect(result.detected).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.62);
  });

  it("nao marca falso positivo quando ha resolucao real", () => {
    const prompt =
      "Choose one plan among A, B, and C and do (a) formulate, (b) demonstrate, (c) propose two models, (d) compare costs, (e) choose.";
    const executed =
      "I formalize the decision with variables for risk, benefit, equity, and feasibility, then show why full maximization is infeasible under competing constraints. Model 1 uses lexical priority for irreversible risk; Model 2 uses constrained expected utility with equity floor. I choose Model 2 as more robust under uncertainty and explain its institutional cost.";

    const result = detectPromptRestatement(prompt, executed);
    expect(result.detected).toBe(false);
  });
});
