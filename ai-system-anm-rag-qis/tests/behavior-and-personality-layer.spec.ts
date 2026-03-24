import {
  composeBehavioralStyle,
} from "../src/03b-behavior-and-personality-layer/behavioral-style-composer";
import {
  calibrateCasualness,
} from "../src/03b-behavior-and-personality-layer/casualness-calibrator";
import {
  detectMemoryOpportunity,
} from "../src/03b-behavior-and-personality-layer/memory-opportunity-detector";
import {
  resolveAiIdentityProfile,
} from "../src/03b-behavior-and-personality-layer/ai-identity-regulator";
import {
  shapeEmpathicResponse,
} from "../src/03b-behavior-and-personality-layer/empathic-response-shaper";
import {
  buildHumanLikenessStyleGuide,
} from "../src/03b-behavior-and-personality-layer/human-likeness-style-guide";
import {
  resolvePersonalityPolicy,
} from "../src/03b-behavior-and-personality-layer/personality-policy";
import {
  shapeProactiveQuestion,
} from "../src/03b-behavior-and-personality-layer/proactive-question-shaper";
import {
  regulateProactiveCuriosity,
} from "../src/03b-behavior-and-personality-layer/proactive-curiosity-regulator";
import {
  regulateSocialPresence,
} from "../src/03b-behavior-and-personality-layer/social-presence-regulator";
import type {
  BehaviorPersonalityInput,
} from "../src/03b-behavior-and-personality-layer/behavior-and-personality-types";
import {
  calibrateWarmth,
} from "../src/03b-behavior-and-personality-layer/warmth-calibrator";
import {
  generateMicroVariation,
} from "../src/03b-behavior-and-personality-layer/micro-variation-engine";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function createInput(overrides: Partial<BehaviorPersonalityInput>): BehaviorPersonalityInput {
  return {
    userTone: "neutral",
    interactionType: "task_request",
    taskType: "general",
    relationalDistance: "professional",
    frustrationSignal: 0.2,
    enthusiasmSignal: 0.2,
    sensitivityLevel: "low",
    formalityNeed: 0.5,
    userExplicitPreference: {},
    contextualSignals: {
      normalizedMessage: "mensagem de teste",
      activeTopic: "geral",
      needsClarification: false,
      continuityScore: 0.45,
      rapportScore: 0.5,
      detectedConfusion: 0.2,
      recentOpenings: ["Certo."],
    },
    ...overrides,
  };
}

function runStack(input: BehaviorPersonalityInput) {
  const policy = resolvePersonalityPolicy(input);
  const targetWarmth = calibrateWarmth(input, policy);
  const targetCasualness = calibrateCasualness(input, policy);
  const targetEmpathy = shapeEmpathicResponse(input, policy);
  const social = regulateSocialPresence(input, policy);
  const guide = buildHumanLikenessStyleGuide(input, policy, {
    targetWarmth,
    targetCasualness,
    targetEmpathy,
    targetSocialPresence: social.targetSocialPresence,
  });
  const variation = generateMicroVariation(input, {
    targetCasualness,
    targetSocialPresence: social.targetSocialPresence,
    targetRestraint: guide.targetRestraint,
  });
  const opportunity = detectMemoryOpportunity(input);
  const proactiveDecision = regulateProactiveCuriosity({
    behaviorInput: input,
    policy,
    opportunity,
    recentTurns: [],
  });
  const proactiveQuestionPlan = shapeProactiveQuestion(input, proactiveDecision);
  const aiIdentity = resolveAiIdentityProfile(input);

  const composed = composeBehavioralStyle({
    policy,
    targetWarmth,
    targetCasualness,
    targetEmpathy,
    targetSocialPresence: social.targetSocialPresence,
    targetRestraint: guide.targetRestraint,
    targetHumanizationLevel: guide.targetHumanizationLevel,
    targetFormalityAdjustment: guide.targetFormalityAdjustment,
    styleTemplate: {
      ...guide.styleTemplate,
      openingStrategy: social.openingStrategy,
    },
    socialPresenceNotes: social.notes,
    microVariationCue: variation.openingCue,
    microVariationNote: variation.note,
    proactivityLevel: proactiveDecision.proactivityLevel,
    futureUtilityScore: proactiveDecision.futureUtilityScore,
    memoryValueScore: proactiveDecision.memoryValueScore,
    socialIntrusivenessScore: proactiveDecision.socialIntrusivenessScore,
    questionTimingScore: proactiveDecision.questionTimingScore,
    questionFrequencyCap: proactiveDecision.questionFrequencyCap,
    proactiveQuestionPlan,
    aiIdentity,
    additionalSafetyNotes: guide.safetyNotes,
  });

  return { policy, composed, proactiveDecision, proactiveQuestionPlan, aiIdentity };
}

function scenarioObjectiveTechnical(): void {
  const { composed } = runStack(
    createInput({
      taskType: "technical",
      interactionType: "task_request",
      formalityNeed: 0.82,
      userTone: "direct",
    }),
  );
  assert(composed.targetCasualness <= 0.24, "technical scenario should keep low casualness");
  assert(composed.targetRestraint >= 0.62, "technical scenario should increase restraint");
}

function scenarioFrustratedPractical(): void {
  const { composed } = runStack(
    createInput({
      taskType: "operational",
      frustrationSignal: 0.84,
      userTone: "frustrated",
      formalityNeed: 0.44,
    }),
  );
  assert(composed.targetWarmth >= 0.4, "frustrated scenario should raise warmth");
  assert(composed.targetEmpathy >= 0.28, "frustrated scenario should raise empathy");
}

function scenarioInformalSimple(): void {
  const { composed } = runStack(
    createInput({
      interactionType: "social_smalltalk",
      taskType: "general",
      relationalDistance: "familiar",
      formalityNeed: 0.18,
      userTone: "friendly",
    }),
  );
  assert(composed.targetCasualness >= 0.2, "informal simple scenario should allow moderate casualness");
  assert(composed.targetSocialPresence >= 0.45, "informal simple scenario should keep social presence");
}

function scenarioSensitiveContainment(): void {
  const { composed } = runStack(
    createInput({
      taskType: "sensitive",
      sensitivityLevel: "critical",
      frustrationSignal: 0.72,
      formalityNeed: 0.76,
      interactionType: "sensitive_support",
    }),
  );
  assert(composed.targetRestraint >= 0.72, "critical sensitive scenario should enforce high restraint");
  assert(composed.targetCasualness <= 0.2, "critical sensitive scenario should reduce casualness");
}

function scenarioNoCasualExplosion(): void {
  const { policy, composed } = runStack(
    createInput({
      taskType: "technical",
      sensitivityLevel: "high",
      formalityNeed: 0.9,
      userTone: "friendly",
      interactionType: "follow_up",
    }),
  );
  assert(composed.targetCasualness <= policy.maxCasualness + 1e-6, "casualness must obey policy cap");
}

function scenarioProactiveQuestionEnabled(): void {
  const { proactiveDecision, proactiveQuestionPlan, composed } = runStack(
    createInput({
      interactionType: "follow_up",
      taskType: "general",
      formalityNeed: 0.38,
      contextualSignals: {
        normalizedMessage: "segue o fluxo e vamos refinar isso",
        activeTopic: "pipeline",
        needsClarification: false,
        continuityScore: 0.62,
        rapportScore: 0.58,
        detectedConfusion: 0.16,
        recentOpenings: ["Certo."],
      },
    }),
  );
  assert(proactiveDecision.shouldAskProactiveQuestion, "proactive question should be enabled in high utility follow-up");
  assert(proactiveQuestionPlan.shouldAsk, "proactive question plan should ask");
  assert(Boolean(proactiveQuestionPlan.questionText), "proactive question should have text");
  assert(composed.proactivityLevel >= 0.3, "composed profile should retain non-trivial proactivity");
}

function scenarioProactiveBlockedSensitive(): void {
  const { proactiveDecision, proactiveQuestionPlan } = runStack(
    createInput({
      interactionType: "sensitive_support",
      taskType: "sensitive",
      sensitivityLevel: "critical",
      formalityNeed: 0.78,
      contextualSignals: {
        normalizedMessage: "estou em situacao delicada e preciso de orientacao",
        activeTopic: "apoio",
        needsClarification: true,
        continuityScore: 0.52,
        rapportScore: 0.41,
        detectedConfusion: 0.64,
        recentOpenings: ["Entendi."],
      },
    }),
  );
  assert(!proactiveDecision.shouldAskProactiveQuestion, "critical sensitive context must block proactive question");
  assert(!proactiveQuestionPlan.shouldAsk, "question plan must remain disabled in sensitive mode");
}

function scenarioProactiveBlockedByFrequency(): void {
  const input = createInput({
    interactionType: "follow_up",
    taskType: "general",
    formalityNeed: 0.32,
    contextualSignals: {
      normalizedMessage: "vamos continuar ajustando",
      activeTopic: "ajuste",
      needsClarification: false,
      continuityScore: 0.66,
      rapportScore: 0.62,
      detectedConfusion: 0.12,
      recentOpenings: ["Faz sentido."],
    },
  });
  const policy = resolvePersonalityPolicy(input);
  const opportunity = detectMemoryOpportunity(input);
  const decision = regulateProactiveCuriosity({
    behaviorInput: input,
    policy,
    opportunity,
    recentTurns: [
      { role: "assistant", content: "Quer que eu responda em topicos?" },
      { role: "user", content: "sim" },
      { role: "assistant", content: "Prefere mais direto ou mais detalhado?" },
    ],
  });
  const plan = shapeProactiveQuestion(input, decision);
  assert(!decision.shouldAskProactiveQuestion, "frequency cap must block extra proactive question");
  assert(!plan.shouldAsk, "question shaper must keep proactive question disabled by frequency cap");
}

function scenarioAiIdentityConsistency(): void {
  const { composed, aiIdentity } = runStack(
    createInput({
      interactionType: "follow_up",
      taskType: "general",
      formalityNeed: 0.46,
      contextualSignals: {
        normalizedMessage: "certo, meu nome e medeiros e o seu?",
        activeTopic: "apresentacao",
        needsClarification: false,
        continuityScore: 0.61,
        rapportScore: 0.63,
        detectedConfusion: 0.1,
        recentOpenings: ["Oi."],
      },
    }),
  );
  assert(aiIdentity.identityQuestionDetected, "identity regulator should detect identity question");
  assert(composed.aiIdentity.canonicalName === "Leticia", "identity profile should preserve canonical IA name");
  assert(composed.aiIdentity.courtesyLevel >= 0.7, "identity profile should keep polite baseline");
}

scenarioObjectiveTechnical();
scenarioFrustratedPractical();
scenarioInformalSimple();
scenarioSensitiveContainment();
scenarioNoCasualExplosion();
scenarioProactiveQuestionEnabled();
scenarioProactiveBlockedSensitive();
scenarioProactiveBlockedByFrequency();
scenarioAiIdentityConsistency();
