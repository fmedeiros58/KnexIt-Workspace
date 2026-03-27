import { buildFounderIdentityInfluence } from "../src/12b-founder-influence-layer/founder-identity-bridge";
import { buildFounderReasoningInfluence } from "../src/12b-founder-influence-layer/founder-reasoning-bridge";
import { buildFounderEpistemicInfluence } from "../src/12b-founder-influence-layer/founder-epistemic-bridge";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function shouldTransportIdentityDirectives(): void {
  const influence = buildFounderIdentityInfluence();
  assert(influence.founderName === "Francimar de Lima Medeiros", "expected founder full name");
  assert(influence.identityInfluenceDirectives.length >= 4, "expected identity directives");
  assert(influence.protectedGroundingFacts.length >= 4, "expected grounding facts");
}

function shouldTransportReasoningDirectives(): void {
  const influence = buildFounderReasoningInfluence();
  assert(influence.reasoningWeight > 0.5, "expected reasoning weight");
  assert(influence.reasoningInfluenceDirectives.length >= 4, "expected reasoning directives");
  assert(influence.epistemicVectors.length >= 5, "expected epistemic vectors");
}

function shouldTransportEpistemicDirectives(): void {
  const influence = buildFounderEpistemicInfluence();
  assert(influence.epistemicWeight > 0.5, "expected epistemic weight");
  assert(influence.validationInfluenceDirectives.length >= 3, "expected validation directives");
}

shouldTransportIdentityDirectives();
shouldTransportReasoningDirectives();
shouldTransportEpistemicDirectives();
