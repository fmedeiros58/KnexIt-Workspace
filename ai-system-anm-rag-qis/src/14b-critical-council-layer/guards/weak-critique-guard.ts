import type {
  CouncilAdvisorReport,
  CouncilRiskLevel,
  CouncilSynthesisResult,
  WeakCritiqueGuardResult,
} from "../council-types";

interface WeakCritiqueFinding {
  readonly signal: string;
  readonly advisorId?: string;
  readonly advisorName?: string;
  readonly reason: string;
  readonly requiredSpecificity: string;
}

interface CritiqueTextProfile {
  readonly text: string;
  readonly wordCount: number;
  readonly hasVaguePattern: boolean;
  readonly hasConcreteAnchor: boolean;
  readonly hasActionableVerb: boolean;
  readonly hasReasoningConnector: boolean;
  readonly hasSpecificRiskOrObject: boolean;
}

interface RevisionPriorityLike {
  readonly issue?: unknown;
  readonly reason?: unknown;
  readonly recommendedAction?: unknown;
  readonly severity?: unknown;
  readonly sourceAdvisor?: unknown;
}

const MIN_USEFUL_CRITIQUE_WORDS = 8;
const MIN_TOP_ISSUE_REASON_WORDS = 7;

const VAGUE_PATTERNS: readonly RegExp[] = [
  /\b(pode melhorar|poderia melhorar|can be improved)\b/i,
  /\b(esta bom|está bom|looks good)\b/i,
  /\b(alguns pontos|some points)\b/i,
  /\b(concordo com voce|concordo com você|i agree with you)\b/i,
  /\b(ideia interessante|interesting idea)\b/i,
  /\b(precisa melhorar|needs improvement)\b/i,
  /\b(falta clareza|lacks clarity)\b/i,
  /\b(melhorar a qualidade|improve quality)\b/i,
  /\b(ficou legal|ficou bom|ficou excelente)\b/i,
  /\b(good job|great point|nice idea)\b/i,
];

const CONCRETE_ANCHOR_PATTERNS: readonly RegExp[] = [
  /\b(premissa|premise)\b/i,
  /\b(conclus[aã]o|conclusion)\b/i,
  /\b(evid[eê]ncia|evidence|fonte|source|support)\b/i,
  /\b(contradi[cç][aã]o|contradiction)\b/i,
  /\b(restri[cç][aã]o|constraint)\b/i,
  /\b(vari[aá]vel|variable)\b/i,
  /\b(cen[aá]rio|scenario|caso|case)\b/i,
  /\b(formato|format)\b/i,
  /\b(idioma|language)\b/i,
  /\b(tom|tone)\b/i,
  /\b(repeti[cç][aã]o|repetition)\b/i,
  /\b(bajula[cç][aã]o|sycophancy|over-agreement|agreement)\b/i,
  /\b(confian[cç]a|confidence|certainty)\b/i,
  /\b(risco|risk)\b/i,
  /\b(hip[oó]tese|hypothesis)\b/i,
  /\b(contraexemplo|counterexample)\b/i,
  /\b(cita[cç][aã]o|citation)\b/i,
];

const ACTIONABLE_VERB_PATTERNS: readonly RegExp[] = [
  /\b(remova|remove)\b/i,
  /\b(adicione|add)\b/i,
  /\b(reescreva|rewrite)\b/i,
  /\b(reduza|reduce)\b/i,
  /\b(aumente|increase)\b/i,
  /\b(separe|separate)\b/i,
  /\b(explique|explain)\b/i,
  /\b(justifique|justify)\b/i,
  /\b(teste|test)\b/i,
  /\b(valide|validate)\b/i,
  /\b(compare|comparar|compare)\b/i,
  /\b(corrija|correct|fix)\b/i,
  /\b(especifique|specify)\b/i,
  /\b(substitua|replace)\b/i,
  /\b(qualifique|qualify)\b/i,
  /\b(calibre|calibrate)\b/i,
  /\b(preserve|preservar)\b/i,
];

const REASONING_CONNECTOR_PATTERNS: readonly RegExp[] = [
  /\b(porque|pois|uma vez que|because|since)\b/i,
  /\b(para que|so that)\b/i,
  /\b(a fim de|in order to)\b/i,
  /\b(antes de|before)\b/i,
  /\b(devido a|due to)\b/i,
  /\b(com base|based on)\b/i,
  /\b(caso contr[aá]rio|otherwise)\b/i,
];

const SPECIFIC_RISK_OR_OBJECT_PATTERNS: readonly RegExp[] = [
  /\b(high|critical|medium|low)\b/i,
  /\b(alto|critico|cr[ií]tico|m[eé]dio|baixo)\b/i,
  /\b(sem suporte|unsupported)\b/i,
  /\b(incompleto|incomplete)\b/i,
  /\b(n[aã]o resolvido|unresolved)\b/i,
  /\b(pendente|pending)\b/i,
  /\b(fr[aá]gil|weak)\b/i,
  /\b(excessivo|excessive)\b/i,
  /\b(autom[aá]tico|automatic)\b/i,
  /\b(necess[aá]rio|required)\b/i,
];

const HIGH_RISK_LEVELS: readonly CouncilRiskLevel[] = ["high", "critical"];

export function checkWeakCritique(
  advisorReports: CouncilAdvisorReport[],
  synthesisResult: CouncilSynthesisResult,
): WeakCritiqueGuardResult {
  const findings = dedupeFindings([
    ...findWeakAdvisorCritiques(advisorReports),
    ...findWeakSynthesisTopIssues(synthesisResult),
    ...findWeakSynthesisRecommendation(synthesisResult),
  ]);

  return {
    passed: findings.length === 0,
    weakCritiqueSignals: findings.map((finding) => finding.signal),
    requiredSpecificity: findings.map((finding) => finding.requiredSpecificity),
  };
}

function findWeakAdvisorCritiques(
  advisorReports: readonly CouncilAdvisorReport[],
): WeakCritiqueFinding[] {
  const findings: WeakCritiqueFinding[] = [];

  for (const report of advisorReports) {
    const profile = buildAdvisorCritiqueProfile(report);
    const hasMaterialRisk = isMaterialRisk(report.risk) || !report.passed;
    const hasAnyCritique =
      (report.concerns ?? []).length > 0 ||
      (report.requiredRevisions ?? []).length > 0 ||
      (report.optionalRevisions ?? []).length > 0;

    if (hasMaterialRisk && !hasAnyCritique) {
      findings.push({
        signal: `missing_critique_in_${report.advisorId}`,
        advisorId: report.advisorId,
        advisorName: report.advisorName,
        reason:
          "The advisor reports elevated risk or failed status, but does not provide concrete critique.",
        requiredSpecificity: `${report.advisorName}: provide at least one concrete concern and one actionable revision linked to the risk.`,
      });

      continue;
    }

    if (!profile.text) {
      continue;
    }

    if (profile.hasVaguePattern && !isCritiqueSpecific(profile)) {
      findings.push({
        signal: `vague_feedback_in_${report.advisorId}`,
        advisorId: report.advisorId,
        advisorName: report.advisorName,
        reason:
          "The advisor uses vague feedback without enough concrete issue, reason or corrective action.",
        requiredSpecificity: `${report.advisorName}: specify the concrete issue, why it matters and the corrective action required.`,
      });
    }

    if (
      hasMaterialRisk &&
      profile.wordCount < MIN_USEFUL_CRITIQUE_WORDS &&
      !isCritiqueSpecific(profile)
    ) {
      findings.push({
        signal: `too_short_critique_in_${report.advisorId}`,
        advisorId: report.advisorId,
        advisorName: report.advisorName,
        reason:
          "The advisor critique is too short for a material risk finding.",
        requiredSpecificity: `${report.advisorName}: expand the critique with the affected dimension, failure mode and revision path.`,
      });
    }

    if (
      hasMaterialRisk &&
      (report.requiredRevisions ?? []).length === 0 &&
      !hasActionableRevision(profile)
    ) {
      findings.push({
        signal: `risk_without_actionable_revision_in_${report.advisorId}`,
        advisorId: report.advisorId,
        advisorName: report.advisorName,
        reason:
          "The advisor identifies risk but does not provide an actionable required revision.",
        requiredSpecificity: `${report.advisorName}: add a required revision that tells the rewriter exactly what to change.`,
      });
    }
  }

  return findings;
}

function findWeakSynthesisTopIssues(
  synthesisResult: CouncilSynthesisResult,
): WeakCritiqueFinding[] {
  const findings: WeakCritiqueFinding[] = [];
  const topIssues = getTopIssues(synthesisResult);

  if (topIssues.length === 0) {
    return findings;
  }

  const allReasonsWeak = topIssues.every((issue) => {
    const reason = normalizeText(getString(issue.reason));
    const profile = buildTextProfile(reason);

    return (
      profile.wordCount < MIN_TOP_ISSUE_REASON_WORDS ||
      !profile.hasConcreteAnchor ||
      !profile.hasActionableVerb
    );
  });

  if (allReasonsWeak) {
    findings.push({
      signal: "top_issues_without_actionable_reason",
      reason:
        "All top priority issues have weak or non-actionable reasons.",
      requiredSpecificity:
        "Prioritize issue reasons with explicit correction paths: name the issue, explain why it matters and state what must change.",
    });
  }

  for (const issue of topIssues) {
    const issueName = getString(issue.issue);
    const reason = getString(issue.reason);
    const recommendedAction = getString(issue.recommendedAction);
    const profile = buildTextProfile(`${issueName} ${reason} ${recommendedAction}`);

    if (!profile.hasConcreteAnchor || !profile.hasActionableVerb) {
      findings.push({
        signal: `weak_top_issue:${slugify(issueName || "unknown_issue")}`,
        reason:
          "A top issue lacks either a concrete anchor or an actionable correction.",
        requiredSpecificity: `Top issue "${issueName || "unknown"}": include a concrete affected dimension and a recommended correction.`,
      });
    }
  }

  return findings;
}

function findWeakSynthesisRecommendation(
  synthesisResult: CouncilSynthesisResult,
): WeakCritiqueFinding[] {
  const findings: WeakCritiqueFinding[] = [];
  const finalRecommendation = synthesisResult.finalRecommendation;

  if (!finalRecommendation) {
    findings.push({
      signal: "missing_final_recommendation_specificity",
      reason:
        "The synthesis result does not include a final recommendation.",
      requiredSpecificity:
        "Synthesis: provide a final recommendation with action, reasons and required revisions.",
    });

    return findings;
  }

  const action = getString(finalRecommendation.action);
  const reasons = toStringArray(finalRecommendation.reasons);
  const requiredRevisions = toStringArray(finalRecommendation.requiredRevisions);

  if (action !== "approve" && reasons.length === 0) {
    findings.push({
      signal: "non_approval_without_reasons",
      reason:
        "The final recommendation does not approve, but gives no reasons.",
      requiredSpecificity:
        "Synthesis: explain why the response must be revised, regenerated, caveated or blocked.",
    });
  }

  if (
    ["revise", "regenerate", "block_delivery", "ask_clarification"].includes(action) &&
    requiredRevisions.length === 0 &&
    action !== "ask_clarification"
  ) {
    findings.push({
      signal: "non_approval_without_required_revisions",
      reason:
        "The final recommendation requires intervention but does not provide required revisions.",
      requiredSpecificity:
        "Synthesis: provide concrete required revisions before sending the response to repair or regeneration.",
    });
  }

  const combined = buildTextProfile(
    [...reasons, ...requiredRevisions].join(" "),
  );

  if (
    action !== "approve" &&
    combined.text &&
    !isCritiqueSpecific(combined)
  ) {
    findings.push({
      signal: "final_recommendation_too_vague",
      reason:
        "The final recommendation exists but lacks enough specificity.",
      requiredSpecificity:
        "Synthesis: state the concrete failure, the affected dimension and the corrective action.",
    });
  }

  return findings;
}

function buildAdvisorCritiqueProfile(
  report: CouncilAdvisorReport,
): CritiqueTextProfile {
  return buildTextProfile(
    [
      ...(report.concerns ?? []),
      ...(report.requiredRevisions ?? []),
      ...(report.optionalRevisions ?? []),
      ...(report.missingCounterpoints ?? []),
      ...(report.unsupportedClaims ?? []),
      ...(report.contradictions ?? []),
      ...(report.overAgreementSignals ?? []),
    ].join(" "),
  );
}

function buildTextProfile(text: string): CritiqueTextProfile {
  const normalized = normalizeText(text);

  return {
    text: normalized,
    wordCount: wordCount(normalized),
    hasVaguePattern: VAGUE_PATTERNS.some((pattern) => pattern.test(text)),
    hasConcreteAnchor: CONCRETE_ANCHOR_PATTERNS.some((pattern) =>
      pattern.test(text),
    ),
    hasActionableVerb: ACTIONABLE_VERB_PATTERNS.some((pattern) =>
      pattern.test(text),
    ),
    hasReasoningConnector: REASONING_CONNECTOR_PATTERNS.some((pattern) =>
      pattern.test(text),
    ),
    hasSpecificRiskOrObject: SPECIFIC_RISK_OR_OBJECT_PATTERNS.some((pattern) =>
      pattern.test(text),
    ),
  };
}

function isCritiqueSpecific(profile: CritiqueTextProfile): boolean {
  const specificityScore = [
    profile.hasConcreteAnchor,
    profile.hasActionableVerb,
    profile.hasReasoningConnector,
    profile.hasSpecificRiskOrObject,
  ].filter(Boolean).length;

  return profile.wordCount >= MIN_USEFUL_CRITIQUE_WORDS && specificityScore >= 2;
}

function hasActionableRevision(profile: CritiqueTextProfile): boolean {
  return profile.hasActionableVerb && profile.hasConcreteAnchor;
}

function isMaterialRisk(risk: CouncilRiskLevel): boolean {
  return HIGH_RISK_LEVELS.includes(risk);
}

function getTopIssues(
  synthesisResult: CouncilSynthesisResult,
): RevisionPriorityLike[] {
  const topIssues = synthesisResult.revisionPriority?.topIssues;

  if (!Array.isArray(topIssues)) {
    return [];
  }

  return topIssues.filter(isRecord) as RevisionPriorityLike[];
}

function dedupeFindings(
  findings: readonly WeakCritiqueFinding[],
): WeakCritiqueFinding[] {
  const bySignal = new Map<string, WeakCritiqueFinding>();

  for (const finding of findings) {
    const existing = bySignal.get(finding.signal);

    if (!existing) {
      bySignal.set(finding.signal, finding);
      continue;
    }

    bySignal.set(finding.signal, {
      ...existing,
      requiredSpecificity:
        existing.requiredSpecificity.length >= finding.requiredSpecificity.length
          ? existing.requiredSpecificity
          : finding.requiredSpecificity,
    });
  }

  return Array.from(bySignal.values());
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => getString(entry))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeText(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return normalizeText(text)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean).length;
}

function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}