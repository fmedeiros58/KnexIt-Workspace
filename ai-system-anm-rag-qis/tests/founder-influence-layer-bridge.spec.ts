import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";
import { runFounderInfluenceLayer } from "../src/12b-founder-influence-layer/founder-influence-layer-bridge";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function shouldPopulateFounderInfluenceArtifacts(): Promise<void> {
  const state = createInitialProcessingState("quem e medeiros?");
  const updated = await runFounderInfluenceLayer(state);
  const influence = updated.executionArtifacts.founderInfluence;

  assert(!!influence, "expected founder influence artifacts");
  assert(influence?.founderName === "Francimar de Lima Medeiros", "expected founder full name");
  assert(influence?.founderRole === "fundador_epistemologico_da_leticia", "expected founder role");
  assert((influence?.identityInfluenceDirectives.length || 0) >= 4, "expected identity directives");
  assert((influence?.reasoningInfluenceDirectives.length || 0) >= 4, "expected reasoning directives");
  assert((influence?.validationInfluenceDirectives.length || 0) >= 3, "expected validation directives");
}

await shouldPopulateFounderInfluenceArtifacts();
