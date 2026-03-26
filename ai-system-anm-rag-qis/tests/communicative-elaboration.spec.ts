import { runCommunicativeElaborationOrchestrator } from "../src/14-reasoning-and-generation-layer/communicative-elaboration-and-co-construction/communicative-elaboration-orchestrator";
import type { GroundedEvidencePacket } from "../src/07-knowledge-retrieval-and-research-layer/grounding/grounded-evidence-packet";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const grounding: GroundedEvidencePacket = {
  query: "como refinar uma analise critica",
  supporting: [
    {
      id: "s1",
      stance: "supporting",
      sourceType: "retrieved_evidence",
      title: "evidencia principal",
      snippet: "Separar fato, inferencia e hipotese melhora qualidade argumentativa.",
      url: "memory://evidence/1",
      score: 0.71,
      tags: ["support"],
    },
  ],
  contrasting: [],
  gaps: [],
  dialogicContext: [],
  confidence: 0.66,
  conflictLevel: 0.12,
  summary: "evidencia parcial com boa aderencia ao pedido",
  createdAt: new Date().toISOString(),
};

const output = runCommunicativeElaborationOrchestrator({
  message: "quero refinar uma analise critica da dissertação com foco em evidencias",
  activeContext: ["tema: metodologia"],
  constraints: [],
  route: "inferential",
  grounding,
});

assert(
  output.ideaSeed.userGoal === "refinar" || output.ideaSeed.userGoal === "analisar_criticamente",
  "expected a refinement/critical-analysis goal",
);
assert(output.decomposition.rootConcepts.length > 0, "root concepts should not be empty");
assert(output.tensions.some((row) => row.id === "tension:fato-vs-hipotese"), "must include fact-vs-hypothesis tension");
assert(output.hypothesisBranches.length > 0, "hypothesis branches should be generated");
assert(output.refinement.synthesizedDraft.length > 40, "refinement synthesized draft should be meaningful");
assert(output.confidence >= 0.35, "orchestrator confidence should be at least moderate");

test('bootstrap assertions executed', () => {
  expect(true).toBe(true);
});
