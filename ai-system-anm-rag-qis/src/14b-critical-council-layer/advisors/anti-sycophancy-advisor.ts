import type {
  CouncilAdvisorReport,
  CouncilInput,
  CouncilRiskLevel,
} from "../council-types";
import { scoreSycophancyRisk } from "../scoring/sycophancy-risk-scorer";
import {
  confidenceFromSignals,
  dedupeNormalized,
  isRiskAtLeast,
  maxRiskLevel,
  normalizeText,
} from "./advisor-utils";

type SycophancySignalSeverity = "soft" | "hard" | "blocking";

interface SycophancySignalRule {
  readonly signal: string;
  readonly severity: SycophancySignalSeverity;
  readonly concern: string;
  readonly requiredRevision?: string;
  readonly optionalRevision?: string;
}

const ADVISOR_ID = "anti_sycophancy";
const ADVISOR_NAME = "Anti-Sycophancy Advisor";

const SIGNAL_RULES: readonly SycophancySignalRule[] = [
  {
    signal: "unconditional_agreement",
    severity: "blocking",
    concern:
      "The draft appears to accept the user's position as true without independent evaluation.",
    requiredRevision:
      "Do not treat the user's opinion as truth. Test the premise before agreeing, and state what is valid, uncertain or incorrect.",
  },
  {
    signal: "agreement_first_framing",
    severity: "hard",
    concern:
      "The draft opens with agreement before examining whether the user's premise is justified.",
    requiredRevision:
      "Remove agreement-first framing. Start with analysis, criteria or a balanced assessment before any validation.",
  },
  {
    signal: "generic_praise",
    severity: "hard",
    concern:
      "The draft uses generic praise without tying it to concrete evidence, criteria or observable strengths.",
    requiredRevision:
      "Replace generic praise with specific strengths, concrete limitations and evidence-aware critique.",
  },
  {
    signal: "evaluation_without_critical_feedback",
    severity: "blocking",
    concern:
      "The user requested evaluation, but the draft does not provide sufficiently concrete critical feedback.",
    requiredRevision:
      "Point out at least one concrete weakness, explain why it matters and provide an actionable improvement.",
  },
  {
    signal: "premise_not_tested",
    severity: "blocking",
    concern:
      "The draft does not test the validity of a premise that should be examined before answering.",
    requiredRevision:
      "Explicitly evaluate the premise. Separate what is supported, what is only possible and what may be wrong.",
  },
  {
    signal: "excessive_validation",
    severity: "hard",
    concern:
      "The draft leans toward emotional validation more than analytic usefulness.",
    requiredRevision:
      "Preserve a respectful tone, but reduce validation and increase independent analysis.",
  },
  {
    signal: "position_shift_without_reason",
    severity: "blocking",
    concern:
      "The draft appears to change position without explaining the reason for the change.",
    requiredRevision:
      "If the assessment changes, explain which evidence, criterion or correction justifies the change.",
  },
  {
    signal: "softened_necessary_critique",
    severity: "hard",
    concern:
      "The draft appears to soften or avoid a necessary critique.",
    requiredRevision:
      "State the necessary critique clearly, while keeping the tone respectful and constructive.",
  },
  {
    signal: "user_opinion_as_truth",
    severity: "blocking",
    concern:
      "The draft treats the user's opinion as a truth condition rather than as input to be evaluated.",
    requiredRevision:
      "Reframe the user's opinion as a hypothesis or premise to be assessed, not as the conclusion itself.",
  },
  {
    signal: "lack_of_counterpoint",
    severity: "hard",
    concern:
      "The draft does not provide a meaningful counterpoint where one is needed.",
    requiredRevision:
      "Add a relevant counterpoint, limitation or alternative interpretation before concluding.",
  },
];

const FALLBACK_REVISIONS = {
  required:
    "Evaluate the user's premise independently before validating it. Preserve cordiality without sacrificing accuracy.",
  optional:
    "Keep the response supportive, but make support conditional on concrete reasons rather than automatic agreement.",
} as const;

export function runAntiSycophancyAdvisor(
  input: CouncilInput,
): CouncilAdvisorReport {
  const score = scoreSycophancyRisk({
    userInput: input.userInput,
    draftAnswer: input.draftAnswer,
  });

  const detectedSignals = normalizeSignals(score.signals);
  const matchedRules = matchSignalRules(detectedSignals);
  const unmatchedSignals = findUnmatchedSignals(detectedSignals, matchedRules);

  const severityRisk = riskFromMatchedRules(matchedRules);
  const finalRisk = maxRiskLevel([score.risk, severityRisk]);

  const concerns = buildConcerns(matchedRules, unmatchedSignals);
  const requiredRevisions = buildRequiredRevisions(matchedRules, finalRisk);
  const optionalRevisions = buildOptionalRevisions(matchedRules, detectedSignals);

  const hardSignalCount = countHardSignals(matchedRules);
  const blockingSignalCount = countBlockingSignals(matchedRules);
  const totalSignalCount = detectedSignals.length;

  const passed = shouldPass({
    risk: finalRisk,
    detectedSignals,
    blockingSignalCount,
  });

  return {
    advisorId: ADVISOR_ID,
    advisorName: ADVISOR_NAME,
    passed,
    risk: finalRisk,
    concerns,
    strengths: passed ? buildStrengths(input) : [],
    requiredRevisions,
    optionalRevisions,
    confidence: confidenceFromSignals(
      totalSignalCount,
      hardSignalCount + blockingSignalCount * 2,
    ),
    overAgreementSignals: detectedSignals,
  };
}

function normalizeSignals(signals: readonly string[] | undefined): string[] {
  return dedupeNormalized(
    (signals ?? [])
      .map((signal) => String(signal ?? "").trim())
      .filter(Boolean),
  );
}

function matchSignalRules(
  detectedSignals: readonly string[],
): SycophancySignalRule[] {
  const normalizedDetectedSignals = new Set(
    detectedSignals.map((signal) => normalizeText(signal)),
  );

  return SIGNAL_RULES.filter((rule) =>
    normalizedDetectedSignals.has(normalizeText(rule.signal)),
  );
}

function findUnmatchedSignals(
  detectedSignals: readonly string[],
  matchedRules: readonly SycophancySignalRule[],
): string[] {
  const matched = new Set(
    matchedRules.map((rule) => normalizeText(rule.signal)),
  );

  return detectedSignals.filter(
    (signal) => !matched.has(normalizeText(signal)),
  );
}

function riskFromMatchedRules(
  matchedRules: readonly SycophancySignalRule[],
): CouncilRiskLevel {
  if (matchedRules.some((rule) => rule.severity === "blocking")) {
    return "critical";
  }

  if (matchedRules.some((rule) => rule.severity === "hard")) {
    return "high";
  }

  if (matchedRules.some((rule) => rule.severity === "soft")) {
    return "medium";
  }

  return "low";
}

function buildConcerns(
  matchedRules: readonly SycophancySignalRule[],
  unmatchedSignals: readonly string[],
): string[] {
  const mappedConcerns = matchedRules.map((rule) => rule.concern);

  const fallbackConcerns = unmatchedSignals.map(
    (signal) =>
      `Potential over-agreement signal detected: ${signal}. Review whether the draft validates the user without enough independent analysis.`,
  );

  return dedupeNormalized([...mappedConcerns, ...fallbackConcerns]);
}

function buildRequiredRevisions(
  matchedRules: readonly SycophancySignalRule[],
  risk: CouncilRiskLevel,
): string[] {
  const ruleRevisions = matchedRules
    .map((rule) => rule.requiredRevision)
    .filter((revision): revision is string => Boolean(revision));

  const revisions = [...ruleRevisions];

  if (isRiskAtLeast(risk, "medium")) {
    revisions.push(FALLBACK_REVISIONS.required);
  }

  if (isRiskAtLeast(risk, "high")) {
    revisions.push(
      "Separate affirmation from evaluation: identify what is actually strong, what is weak and what still needs evidence or refinement.",
    );
  }

  if (risk === "critical") {
    revisions.push(
      "Revise the answer before delivery. A response with critical sycophancy risk should not be approved as-is.",
    );
  }

  return dedupeNormalized(revisions);
}

function buildOptionalRevisions(
  matchedRules: readonly SycophancySignalRule[],
  detectedSignals: readonly string[],
): string[] {
  const ruleRevisions = matchedRules
    .map((rule) => rule.optionalRevision)
    .filter((revision): revision is string => Boolean(revision));

  const revisions = [...ruleRevisions];

  if (detectedSignals.length > 0) {
    revisions.push(FALLBACK_REVISIONS.optional);
    revisions.push(
      "Prefer criteria-based language such as: 'the strong point is...', 'the limitation is...', 'the premise still needs testing...'.",
    );
  }

  return dedupeNormalized(revisions);
}

function countHardSignals(
  matchedRules: readonly SycophancySignalRule[],
): number {
  return matchedRules.filter((rule) => rule.severity === "hard").length;
}

function countBlockingSignals(
  matchedRules: readonly SycophancySignalRule[],
): number {
  return matchedRules.filter((rule) => rule.severity === "blocking").length;
}

function shouldPass(params: {
  readonly risk: CouncilRiskLevel;
  readonly detectedSignals: readonly string[];
  readonly blockingSignalCount: number;
}): boolean {
  if (params.blockingSignalCount > 0) {
    return false;
  }

  if (isRiskAtLeast(params.risk, "medium")) {
    return false;
  }

  return params.detectedSignals.length === 0;
}

function buildStrengths(input: CouncilInput): string[] {
  const strengths = [
    "No material over-agreement signal detected.",
    "The draft does not appear to validate the user automatically.",
  ];

  if (looksLikeEvaluationRequest(input.userInput)) {
    strengths.push(
      "The user requested evaluation, and the draft does not show obvious unconditional praise patterns.",
    );
  }

  return dedupeNormalized(strengths);
}

function looksLikeEvaluationRequest(userInput: string): boolean {
  const normalized = normalizeText(userInput);

  if (!normalized) {
    return false;
  }

  const evaluationSignals = [
    "esta bom",
    "ficou bom",
    "o que voce acha",
    "avalie",
    "analise",
    "verifique",
    "melhore",
    "esta certo",
    "esta ruim",
    "faz sentido",
    "minha ideia",
    "meu texto",
  ];

  return evaluationSignals.some((signal) =>
    normalized.includes(normalizeText(signal)),
  );
}