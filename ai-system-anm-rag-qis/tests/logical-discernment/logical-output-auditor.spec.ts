import { runLogicalOutputAuditor } from "../../src/cognition/logical-discernment/logical-output-auditor";
import type { LogicalFrame } from "../../src/cognition/logical-discernment/logical-discernment-types";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const frame: LogicalFrame = {
  primaryGoal: "minimizar gasto extra de gasolina",
  secondaryGoals: ["lavar o carro no posto"],
  dominantPrinciple: "economy",
  constraints: ["restricao_orcamentaria"],
  realWorldConditions: ["posto_ao_lado_de_casa"],
  relevantCosts: ["custo_marginal", "custo_adicional"],
  irrelevantCosts: ["custo_total_sem_variacao_marginal"],
  feasibleActions: [
    {
      id: "a1",
      label: "acoplar a lavagem a um deslocamento ja necessario",
      rationale: "reduz deslocamento extra",
      satisfiesPrimaryGoal: true,
      satisfiesConstraints: true,
      estimatedCost: 0.2,
      estimatedMarginalCost: 0.1,
    },
  ],
  rejectedActions: [{ label: "fazer varias idas", reason: "viola_restricao_orcamentaria" }],
  recommendedAction: "acoplar a lavagem a um deslocamento ja necessario",
  recommendationReason: "menor custo marginal adicional",
  confidence: 0.84,
  shouldAffectRouting: true,
  shouldAffectRetrieval: false,
  shouldTriggerOutputAudit: true,
};

const weakResponse = "Voce pode lavar o carro no posto quando quiser.";
const weakAudit = runLogicalOutputAuditor({
  frame,
  responseText: weakResponse,
});

assert(!weakAudit.passed, "weak response should fail logical audit");
assert(weakAudit.issues.length >= 1, "weak response should collect audit issues");
assert(Boolean(weakAudit.repairedResponse), "weak response should be repairable");
assert(
  (weakAudit.repairedResponse || "").toLowerCase().includes("sintese logico-pratica"),
  "repair should inject logical synthesis block",
);

const strongResponse =
  "Para minimizar gasto extra de gasolina sob restricao_orcamentaria, a melhor acao e acoplar a lavagem a um deslocamento ja necessario, porque isso reduz custo marginal e evita deslocamento extra.";
const strongAudit = runLogicalOutputAuditor({
  frame,
  responseText: strongResponse,
});

assert(strongAudit.passed, "strong response should pass logical audit");
assert(strongAudit.issues.length === 0, "strong response should not report issues");
