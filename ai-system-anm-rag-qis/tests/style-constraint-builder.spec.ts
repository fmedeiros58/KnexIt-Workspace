import { buildStyleConstraints } from "../src/14-reasoning-and-generation-layer/prompt-construction-core/style-constraint-builder";
import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const generic = createInitialProcessingState("tudo bem com vc?");
generic.selectedMode = "chat";
generic.behaviorPersonalityState.aiIdentity.identityQuestionDetected = false;
generic.behaviorPersonalityState.aiIdentity.nameOriginQuestionDetected = false;
const genericConstraints = buildStyleConstraints(generic);
assert(
  !genericConstraints.toLowerCase().includes("base identitaria oficial"),
  "generic chat prompt should not inject full identity narrative",
);
assert(
  genericConstraints.toLowerCase().includes("nao explique origem/significado"),
  "generic chat prompt should explicitly block identity overexpansion",
);

const identityPrompt = createInitialProcessingState("qual o seu nome?");
identityPrompt.selectedMode = "chat";
identityPrompt.behaviorPersonalityState.aiIdentity.identityQuestionDetected = true;
const identityConstraints = buildStyleConstraints(identityPrompt);
assert(
  identityConstraints.toLowerCase().includes("base identitaria oficial"),
  "identity prompt should include official identity narrative",
);


test('bootstrap assertions executed', () => {
  expect(true).toBe(true);
});
