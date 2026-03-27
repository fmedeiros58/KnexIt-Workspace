import { resolveMedeirosIdentityProfile } from "../src/17b-response-behavior-layer/medeiros-identity-submodule/medeiros-identity-resolver";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function shouldDetectFormationQuestion(): void {
  const profile = resolveMedeirosIdentityProfile("qual a formacao de medeiros?");
  assert(profile.formationQuestionDetected, "expected formation question detection");
  assert(
    /letras|medicina|mestrado em educacao/i.test(profile.shortNarrative),
    "expected interdisciplinary formation narrative",
  );
}

function shouldDetectProfessionalQuestion(): void {
  const profile = resolveMedeirosIdentityProfile("medeiros trabalha onde?");
  assert(profile.professionalQuestionDetected, "expected professional question detection");
  assert(
    /educacao basica|niead|docencia/i.test(profile.shortNarrative),
    "expected professional narrative with teaching and NIEAD",
  );
}

function shouldCarryGroundingFacts(): void {
  const profile = resolveMedeirosIdentityProfile("quem e esse medeiros?");
  assert(profile.creatorQuestionDetected, "expected creator question detection");
  assert(
    profile.groundingFacts.some((fact) => /francimar de lima medeiros/i.test(fact)),
    "expected founder full-name grounding fact",
  );
}

shouldDetectFormationQuestion();
shouldDetectProfessionalQuestion();
shouldCarryGroundingFacts();
