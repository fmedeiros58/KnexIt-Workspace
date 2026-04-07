import { runLogicalDiscernmentEngine } from "../../src/cognition/logical-discernment/logical-discernment-engine";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const result = runLogicalDiscernmentEngine({
  message:
    "qual o melhor, se eu tenho um carro pra lavar e o posto fica ao lado da minha casa. o que eu faco para gastar menos gasolina e ainda assim ter meu carro lavado no posto. o principio aqui e a economia.",
  normalizedMessage:
    "qual o melhor, se eu tenho um carro pra lavar e o posto fica ao lado da minha casa. o que eu faco para gastar menos gasolina e ainda assim ter meu carro lavado no posto. o principio aqui e a economia.",
  pragmaticIntent: "otimizar custo marginal",
  speechAct: "request",
  directiveForce: 0.8,
  tokenCount: 52,
  questionCount: 1,
});

assert(result.frame.dominantPrinciple === "economy", "engine should preserve dominant principle");
assert(Boolean(result.frame.primaryGoal), "engine should extract a primary goal");
assert(result.frame.feasibleActions.length >= 1, "engine should return feasible actions");
assert(
  (result.frame.recommendedAction || "").includes("acoplar a lavagem"),
  "engine should recommend attaching wash to an already-needed trip in economy scenario",
);
assert(result.frame.shouldAffectRouting, "logical frame should affect routing in practical optimization case");
assert(result.score >= 0.45, "logical discernment score should be relevant for practical optimization");
