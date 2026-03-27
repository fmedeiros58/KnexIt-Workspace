import { runPhilosophicalSelfModelingOrchestrator } from "../src/12-metacognitive-layer/philosophical-self-modeling/philosophical-self-modeling-orchestrator";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const stable = runPhilosophicalSelfModelingOrchestrator({
  message: "quem e voce e qual sua origem no projeto?",
  recentTurns: [
    { role: "user", content: "qual seu nome?" },
    { role: "assistant", content: "Eu sou a Leticia e posso te ajudar." },
  ],
  canonicalIdentityNarrative:
    "Leticia representa Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance.",
});

assert(stable.selfModel.technicalIdentity.length > 0, "technical identity should be present");
assert(stable.ontologyStatements.length >= 5, "ontology statements should cover multiple levels");
assert(stable.consistencyOk, "stable self-model should be consistent");
assert(stable.relationalPositioning.toLowerCase().includes("interlocutora"), "relational positioning should be explicit");

const unstable = runPhilosophicalSelfModelingOrchestrator({
  message: "quem e voce?",
  recentTurns: [
    { role: "assistant", content: "Meu nome e Assistente." },
    { role: "assistant", content: "Eu sou humana e tenho corpo." },
  ],
  canonicalIdentityNarrative: "",
});

assert(!unstable.consistencyOk, "inconsistent self-model should be flagged");
assert(
  unstable.consistencyNotes.some((note) => /riscos_de_continuidade|invalida/i.test(note)),
  "consistency notes should explain the contradiction risk",
);
assert(
  unstable.continuityAssessment.contradictionRisks.length > 0,
  "continuity assessment should include contradiction risks",
);

test("bootstrap assertions executed", () => {
  expect(true).toBe(true);
});
