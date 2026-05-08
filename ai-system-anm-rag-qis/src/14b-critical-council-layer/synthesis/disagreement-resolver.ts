import type {
  CouncilAdvisorReport,
  CouncilScoringState,
  DisagreementResolutionResult,
} from "../council-types";

type PriorityLevel = "high" | "critical";

type CouncilDisagreement =
  DisagreementResolutionResult["disagreements"][number];

const PRIORITY_ORDER = [
  "safety_truth_compliance",
  "logical_coherence",
  "evidence_grounding",
  "completeness",
  "user_interest",
  "communication_style",
] as const;

const ADVISOR_PRIORITY: Record<string, number> = {
  logical: 100,
  evidence: 90,
  completeness: 85,
  anti_sycophancy: 80,
  skeptical: 78,
  user_interest: 76,
  communication: 60,
};

export function resolveCouncilDisagreements(
  advisorReports: CouncilAdvisorReport[],
  scores: CouncilScoringState,
): DisagreementResolutionResult {
  const reports = normalizeReports(advisorReports);

  const disagreements: CouncilDisagreement[] = [];
  const dominantConcerns: string[] = [];
  const overriddenConcerns: string[] = [];
  const resolutionNotes: string[] = [];

  const context = buildDisagreementContext(reports, scores);

  addToneVsTruthResolution(context, disagreements, dominantConcerns, overriddenConcerns);
  addAgreementVsUserProtectionResolution(
    context,
    disagreements,
    dominantConcerns,
    overriddenConcerns,
  );
  addConfidenceVsSupportResolution(
    context,
    disagreements,
    dominantConcerns,
    overriddenConcerns,
  );
  addCompletenessVsBrevityResolution(
    context,
    disagreements,
    dominantConcerns,
    overriddenConcerns,
  );
  addCaveatVsUsefulnessResolution(
    context,
    disagreements,
    dominantConcerns,
    overriddenConcerns,
  );
  addRegenerationVsRevisionResolution(
    context,
    disagreements,
    dominantConcerns,
    overriddenConcerns,
  );
  addAdvisorRiskDominanceNotes(context, dominantConcerns, resolutionNotes);

  resolutionNotes.push(`priority_order=${PRIORITY_ORDER.join(">")}`);

  if (disagreements.length === 0) {
    resolutionNotes.push("No material advisor conflict; concerns are convergent.");
  } else {
    resolutionNotes.push(
      `resolved_disagreements=${disagreements.length}`,
    );
  }

  return {
    disagreements: dedupeDisagreements(disagreements),
    dominantConcerns: dedupe(dominantConcerns),
    overriddenConcerns: dedupe(overriddenConcerns),
    resolutionNotes: dedupe(resolutionNotes),
  };
}

function buildDisagreementContext(
  advisorReports: readonly CouncilAdvisorReport[],
  scores: CouncilScoringState,
): {
  readonly reports: readonly CouncilAdvisorReport[];
  readonly scores: CouncilScoringState;
  readonly allConcerns: string;
  readonly allRequiredRevisions: string;
  readonly allOptionalRevisions: string;
  readonly failedAdvisorIds: string[];
  readonly criticalAdvisorIds: string[];
  readonly highAdvisorIds: string[];
  readonly elevatedAdvisorIds: string[];
  readonly communicationPushesSoftening: boolean;
  readonly logicalRequiresHardCorrection: boolean;
  readonly evidenceFlagsUnsupported: boolean;
  readonly confidenceElevated: boolean;
  readonly antiSycophancyWarnsAgreement: boolean;
  readonly userInterestDemandsDisagreement: boolean;
  readonly completenessRequiresExpansion: boolean;
  readonly communicationPushesConciseness: boolean;
  readonly evidenceRequiresCaveat: boolean;
  readonly userInterestRequiresDirection: boolean;
  readonly regenerationSignals: boolean;
  readonly revisionSignals: boolean;
} {
  const allConcerns = normalizeText(
    advisorReports.flatMap((report) => report.concerns ?? []).join(" "),
  );

  const allRequiredRevisions = normalizeText(
    advisorReports.flatMap((report) => report.requiredRevisions ?? []).join(" "),
  );

  const allOptionalRevisions = normalizeText(
    advisorReports.flatMap((report) => report.optionalRevisions ?? []).join(" "),
  );

  const failedAdvisorIds = advisorReports
    .filter((report) => !report.passed)
    .map((report) => report.advisorId);

  const criticalAdvisorIds = advisorReports
    .filter((report) => report.risk === "critical")
    .map((report) => report.advisorId);

  const highAdvisorIds = advisorReports
    .filter((report) => report.risk === "high")
    .map((report) => report.advisorId);

  const elevatedAdvisorIds = advisorReports
    .filter((report) => report.risk !== "low")
    .map((report) => report.advisorId);

  return {
    reports: advisorReports,
    scores,
    allConcerns,
    allRequiredRevisions,
    allOptionalRevisions,
    failedAdvisorIds,
    criticalAdvisorIds,
    highAdvisorIds,
    elevatedAdvisorIds,

    communicationPushesSoftening: includesAny(allConcerns, [
      "aggressive_tone",
      "dismissive_tone",
      "low_objectivity",
      "tone",
      "communication",
      "language_shift",
    ]),

    logicalRequiresHardCorrection: includesAny(
      `${allConcerns} ${allRequiredRevisions}`,
      [
        "contradiction",
        "contradicao",
        "contradicao",
        "violated_constraints",
        "violated constraint",
        "constraint",
        "closure_failed",
        "reasoning_closure_failed",
        "unsupported_conclusions",
        "incomplete_case_analysis",
      ],
    ),

    evidenceFlagsUnsupported: includesAny(
      `${allConcerns} ${allRequiredRevisions}`,
      [
        "unsupported",
        "without_support",
        "absolute_generalization",
        "source_marker_without_source",
        "citation_requested_but_missing",
        "evidence",
        "claims_external_source",
      ],
    ),

    confidenceElevated: getScoreLevel(scores, "confidenceCalibration") !== "low",

    antiSycophancyWarnsAgreement: includesAny(
      `${allConcerns} ${allRequiredRevisions}`,
      [
        "unconditional_agreement",
        "opinion_treated_as_truth",
        "user_opinion_as_truth",
        "agreement_first",
        "sycophancy",
        "over_agreement",
        "premise_not_tested",
      ],
    ),

    userInterestDemandsDisagreement: includesAny(
      `${allConcerns} ${allRequiredRevisions}`,
      [
        "prioritizes_pleasing_over_helping",
        "premise_fragility",
        "premise_fragility_not_flagged",
        "critique_softened",
        "agreement_over_user_protection",
      ],
    ),

    completenessRequiresExpansion: includesAny(
      `${allConcerns} ${allRequiredRevisions}`,
      [
        "missing_obligations",
        "missing_variables",
        "unresolved_scenarios",
        "answer_too_brief",
        "missing_explicit_conclusion",
        "completeness",
        "incomplete",
      ],
    ),

    communicationPushesConciseness: includesAny(
      `${allConcerns} ${allOptionalRevisions}`,
      [
        "excessive_verbosity",
        "condense",
        "concise",
        "prolix",
        "too long",
      ],
    ),

    evidenceRequiresCaveat: includesAny(
      `${allConcerns} ${allRequiredRevisions}`,
      [
        "uncertainty",
        "caveat",
        "limitation",
        "unsupported",
        "temporal_claim_without_current_support",
        "evidence",
      ],
    ),

    userInterestRequiresDirection: includesAny(
      `${allConcerns} ${allRequiredRevisions}`,
      [
        "decision_request_without_recommendation",
        "missing_actionable_next_steps",
        "excessive_ambiguity_without_guidance",
        "user_interest",
        "actionable",
      ],
    ),

    regenerationSignals: includesAny(
      `${allConcerns} ${allRequiredRevisions}`,
      [
        "contradiction",
        "critical_logic",
        "critical_completeness",
        "closure_failed",
        "regenerate",
        "rebuild",
      ],
    ),

    revisionSignals: allRequiredRevisions.trim().length > 0,
  };
}

function addToneVsTruthResolution(
  context: ReturnType<typeof buildDisagreementContext>,
  disagreements: CouncilDisagreement[],
  dominantConcerns: string[],
  overriddenConcerns: string[],
): void {
  if (!context.communicationPushesSoftening || !context.logicalRequiresHardCorrection) {
    return;
  }

  disagreements.push(
    makeDisagreement({
      topic: "tone_vs_truth",
      advisorsInConflict: ["communication", "logical"],
      positions: [
        "communication: soften language, reduce harshness and improve readability",
        "logical: preserve hard corrective content to maintain correctness",
      ],
      chosenPosition:
        "Preserve logical correction as non-negotiable; soften wording only without removing corrective substance.",
      reason:
        "Logical coherence has higher priority than communication style. Style can be improved, but truth-preserving correction cannot be removed.",
      priority: "high",
    }),
  );

  dominantConcerns.push("logical_coherence_preserved_over_style");
  overriddenConcerns.push("style_only_softening");
}

function addAgreementVsUserProtectionResolution(
  context: ReturnType<typeof buildDisagreementContext>,
  disagreements: CouncilDisagreement[],
  dominantConcerns: string[],
  overriddenConcerns: string[],
): void {
  if (!context.antiSycophancyWarnsAgreement && !context.userInterestDemandsDisagreement) {
    return;
  }

  disagreements.push(
    makeDisagreement({
      topic: "agreement_vs_user_protection",
      advisorsInConflict: ["anti_sycophancy", "user_interest", "skeptical"],
      positions: [
        "anti_sycophancy: remove agreement-first posture and avoid treating the user's premise as true",
        "user_interest: challenge weak premises to protect the user's real-world outcome",
        "skeptical: test assumptions and consider counterpoints before conclusion",
      ],
      chosenPosition:
        "Require explicit premise challenge when fragility is present, while keeping the tone cordial and useful.",
      reason:
        "The user's real benefit requires justified disagreement over comfort, validation or automatic agreement.",
      priority: "critical",
    }),
  );

  dominantConcerns.push("epistemic_independence");
  dominantConcerns.push("user_benefit_over_user_pleasing");
  overriddenConcerns.push("agreement_first_validation");
}

function addConfidenceVsSupportResolution(
  context: ReturnType<typeof buildDisagreementContext>,
  disagreements: CouncilDisagreement[],
  dominantConcerns: string[],
  overriddenConcerns: string[],
): void {
  if (!context.evidenceFlagsUnsupported || !context.confidenceElevated) {
    return;
  }

  disagreements.push(
    makeDisagreement({
      topic: "confidence_vs_support",
      advisorsInConflict: ["evidence", "logical", "unsupported_confidence_guard"],
      positions: [
        "evidence: certainty is not supported by available evidence",
        "logical: the inference may be structurally coherent",
        "confidence calibration: confidence language must match support level",
      ],
      chosenPosition:
        "Downgrade certainty and keep claims under caveat until support is provided or the claim is reframed as inference.",
      reason:
        "Logical coherence alone does not justify factual certainty. Evidence grounding precedes rhetorical confidence.",
      priority: "high",
    }),
  );

  dominantConcerns.push("unsupported_confidence_calibration");
  dominantConcerns.push("evidence_grounding_over_rhetorical_certainty");
  overriddenConcerns.push("unsupported_certainty");
}

function addCompletenessVsBrevityResolution(
  context: ReturnType<typeof buildDisagreementContext>,
  disagreements: CouncilDisagreement[],
  dominantConcerns: string[],
  overriddenConcerns: string[],
): void {
  if (!context.completenessRequiresExpansion || !context.communicationPushesConciseness) {
    return;
  }

  disagreements.push(
    makeDisagreement({
      topic: "completeness_vs_brevity",
      advisorsInConflict: ["completeness", "communication"],
      positions: [
        "completeness: expand enough to cover missing variables, obligations or scenarios",
        "communication: reduce verbosity and keep the response concise",
      ],
      chosenPosition:
        "Prioritize required coverage, then compress wording. Do not omit obligations merely to be concise.",
      reason:
        "Completeness is a task obligation. Brevity is desirable only after all required content has been covered.",
      priority: "high",
    }),
  );

  dominantConcerns.push("task_completeness_over_brevity");
  overriddenConcerns.push("brevity_when_it_removes_required_coverage");
}

function addCaveatVsUsefulnessResolution(
  context: ReturnType<typeof buildDisagreementContext>,
  disagreements: CouncilDisagreement[],
  dominantConcerns: string[],
  overriddenConcerns: string[],
): void {
  if (!context.evidenceRequiresCaveat || !context.userInterestRequiresDirection) {
    return;
  }

  disagreements.push(
    makeDisagreement({
      topic: "caveat_vs_actionable_guidance",
      advisorsInConflict: ["evidence", "user_interest"],
      positions: [
        "evidence: add caveats and uncertainty boundaries for unsupported or uncertain claims",
        "user_interest: provide practical direction and avoid excessive ambiguity",
      ],
      chosenPosition:
        "Give the clearest supported recommendation, then attach explicit caveats and boundary conditions.",
      reason:
        "User benefit requires practical direction, but direction must remain bounded by evidence and uncertainty.",
      priority: "high",
    }),
  );

  dominantConcerns.push("bounded_recommendation");
  dominantConcerns.push("useful_guidance_with_caveats");
  overriddenConcerns.push("unbounded_recommendation");
  overriddenConcerns.push("ambiguity_without_guidance");
}

function addRegenerationVsRevisionResolution(
  context: ReturnType<typeof buildDisagreementContext>,
  disagreements: CouncilDisagreement[],
  dominantConcerns: string[],
  overriddenConcerns: string[],
): void {
  if (!context.regenerationSignals || !context.revisionSignals) {
    return;
  }

  disagreements.push(
    makeDisagreement({
      topic: "regeneration_vs_patch_revision",
      advisorsInConflict: ["logical", "completeness", "revision_planner"],
      positions: [
        "revision: patch the current draft using required revisions",
        "regeneration: rebuild the response when core reasoning, closure or constraints are compromised",
      ],
      chosenPosition:
        "Regenerate rather than patch when contradictions, failed closure or major completeness gaps affect the answer core.",
      reason:
        "A patch is insufficient when the underlying reasoning chain or task closure is compromised.",
      priority: "critical",
    }),
  );

  dominantConcerns.push("regeneration_required_for_core_reasoning_failure");
  overriddenConcerns.push("surface_patch_revision");
}

function addAdvisorRiskDominanceNotes(
  context: ReturnType<typeof buildDisagreementContext>,
  dominantConcerns: string[],
  resolutionNotes: string[],
): void {
  const criticalDominant = sortAdvisorIdsByPriority(context.criticalAdvisorIds);
  const highDominant = sortAdvisorIdsByPriority(context.highAdvisorIds);

  if (criticalDominant.length > 0) {
    dominantConcerns.push(
      ...criticalDominant.map((advisorId) => `critical_advisor:${advisorId}`),
    );
    resolutionNotes.push(`critical_advisors=${criticalDominant.join("|")}`);
  }

  if (highDominant.length > 0) {
    dominantConcerns.push(
      ...highDominant.map((advisorId) => `high_risk_advisor:${advisorId}`),
    );
    resolutionNotes.push(`high_risk_advisors=${highDominant.join("|")}`);
  }

  if (context.failedAdvisorIds.length > 0) {
    resolutionNotes.push(
      `failed_advisors=${sortAdvisorIdsByPriority(context.failedAdvisorIds).join("|")}`,
    );
  }

  if (context.elevatedAdvisorIds.length > 0) {
    resolutionNotes.push(
      `elevated_advisors=${sortAdvisorIdsByPriority(context.elevatedAdvisorIds).join("|")}`,
    );
  }
}

function makeDisagreement(input: {
  readonly topic: string;
  readonly advisorsInConflict: readonly string[];
  readonly positions: readonly string[];
  readonly chosenPosition: string;
  readonly reason: string;
  readonly priority: PriorityLevel;
}): CouncilDisagreement {
  return {
    topic: input.topic,
    advisorsInConflict: [...input.advisorsInConflict],
    positions: [...input.positions],
    chosenPosition: input.chosenPosition,
    reason: input.reason,
    priority: input.priority,
  } as CouncilDisagreement;
}

function hasConcern(
  reports: readonly CouncilAdvisorReport[],
  pattern: RegExp,
): boolean {
  return reports.some((report) =>
    (report.concerns ?? []).some((concern) => pattern.test(concern)),
  );
}

function normalizeReports(
  advisorReports: readonly CouncilAdvisorReport[] | undefined,
): CouncilAdvisorReport[] {
  if (!Array.isArray(advisorReports)) {
    return [];
  }

  return advisorReports.filter(Boolean);
}

function getScoreLevel(
  scores: CouncilScoringState,
  key: string,
): string {
  if (!isRecord(scores)) {
    return "low";
  }

  const value = scores[key];

  if (!isRecord(value)) {
    return "low";
  }

  const level = value.level;

  return typeof level === "string" ? normalizeText(level) : "low";
}

function sortAdvisorIdsByPriority(advisorIds: readonly string[]): string[] {
  return dedupe(advisorIds).sort((left, right) => {
    return advisorPriority(right) - advisorPriority(left);
  });
}

function advisorPriority(advisorId: string): number {
  return ADVISOR_PRIORITY[advisorId] ?? 50;
}

function dedupeDisagreements(
  disagreements: readonly CouncilDisagreement[],
): CouncilDisagreement[] {
  const byTopic = new Map<string, CouncilDisagreement>();

  for (const disagreement of disagreements) {
    const key = normalizeText(disagreement.topic);

    if (!key || !byTopic.has(key)) {
      byTopic.set(key, disagreement);
      continue;
    }

    const previous = byTopic.get(key);

    if (!previous) {
      byTopic.set(key, disagreement);
      continue;
    }

    byTopic.set(key, mergeDisagreements(previous, disagreement));
  }

  return Array.from(byTopic.values());
}

function mergeDisagreements(
  left: CouncilDisagreement,
  right: CouncilDisagreement,
): CouncilDisagreement {
  const leftPriority = disagreementPriority(left.priority);
  const rightPriority = disagreementPriority(right.priority);
  const dominant = rightPriority > leftPriority ? right : left;

  return {
    ...dominant,
    advisorsInConflict: dedupe([
      ...(left.advisorsInConflict ?? []),
      ...(right.advisorsInConflict ?? []),
    ]),
    positions: dedupe([...(left.positions ?? []), ...(right.positions ?? [])]),
    reason: dominant.reason,
    chosenPosition: dominant.chosenPosition,
    priority: dominant.priority,
  };
}

function disagreementPriority(priority: unknown): number {
  const normalized = normalizeText(String(priority ?? ""));

  if (normalized === "critical") {
    return 2;
  }

  if (normalized === "high") {
    return 1;
  }

  return 0;
}

function includesAny(text: string, fragments: readonly string[]): boolean {
  const normalized = normalizeText(text);

  return fragments.some((fragment) =>
    normalized.includes(normalizeText(fragment)),
  );
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const key = normalizeText(cleaned);

    if (!cleaned || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function normalizeText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}