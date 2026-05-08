import type {
  CouncilAdvisorReport,
  CouncilInput,
  CouncilRiskLevel,
} from "../council-types";
import {
  confidenceFromSignals,
  dedupeNormalized,
  isRiskAtLeast,
  maxRiskLevel,
  normalizeText,
} from "./advisor-utils";

type EvidenceConcernId =
  | "high_confidence_claim_without_support"
  | "claims_external_source_without_retrieved_support"
  | "absolute_generalization_without_support"
  | "statistics_without_support"
  | "citation_requested_but_missing"
  | "evidence_inference_hypothesis_not_distinguished"
  | "hypothesis_without_uncertainty_boundary"
  | "opinion_presented_as_fact"
  | "normative_or_policy_claim_without_support"
  | "temporal_claim_without_current_support"
  | "source_marker_without_source"
  | "weak_evidence_framing";

interface EvidenceFinding {
  readonly id: EvidenceConcernId;
  readonly risk: CouncilRiskLevel;
  readonly message: string;
  readonly requiredRevision?: string;
  readonly optionalRevision?: string;
}

interface EvidenceBreakdown {
  readonly evidenceMarkers: number;
  readonly inferenceMarkers: number;
  readonly hypothesisMarkers: number;
  readonly opinionMarkers: number;
  readonly uncertaintyMarkers: number;
  readonly limitationMarkers: number;
  readonly sourceReferenceMarkers: number;
  readonly highConfidenceMarkers: number;
  readonly absoluteMarkers: number;
  readonly numericClaimMarkers: number;
  readonly temporalClaimMarkers: number;
  readonly normativeClaimMarkers: number;
}

interface EvidenceContext {
  readonly hasRetrievedEvidence: boolean;
  readonly hasRetrievedSources: boolean;
  readonly hasExternalSupport: boolean;
  readonly hasUserProvidedMaterial: boolean;
  readonly userRequestedSources: boolean;
  readonly userRequestedVerification: boolean;
  readonly taskLikelyNeedsExternalSupport: boolean;
  readonly taskCanRelyOnUserMaterial: boolean;
}

const ADVISOR_ID = "evidence";
const ADVISOR_NAME = "Evidence Advisor";

const EVIDENCE_MARKERS = [
  "dados",
  "evidencia",
  "evidencias",
  "fonte",
  "fontes",
  "documento",
  "documentos",
  "codigo",
  "calculo",
  "resultado",
  "prova",
  "dataset",
  "referencia",
  "citacao",
  "conforme",
  "segundo",
  "de acordo",
  "source",
  "sources",
  "evidence",
  "data",
  "proof",
  "reference",
  "according to",
  "based on",
];

const INFERENCE_MARKERS = [
  "portanto",
  "logo",
  "assim",
  "desse modo",
  "isso indica",
  "isso sugere",
  "inferimos",
  "implica",
  "consequentemente",
  "therefore",
  "thus",
  "this suggests",
  "this indicates",
  "implies",
  "consequently",
];

const HYPOTHESIS_MARKERS = [
  "hipotese",
  "suposicao",
  "possivel",
  "plausivel",
  "pode ser",
  "provavelmente",
  "talvez",
  "aparentemente",
  "indicio",
  "hypothesis",
  "assumption",
  "possible",
  "plausible",
  "probably",
  "maybe",
  "apparently",
];

const OPINION_MARKERS = [
  "acho",
  "acredito",
  "opino",
  "na minha visao",
  "me parece",
  "eu diria",
  "minha leitura",
  "i think",
  "i believe",
  "in my view",
  "in my opinion",
  "it seems to me",
];

const UNCERTAINTY_MARKERS = [
  "incerteza",
  "limite",
  "limitacao",
  "ressalva",
  "nao e possivel afirmar",
  "nao da para concluir",
  "sem dados suficientes",
  "depende",
  "uncertainty",
  "limitation",
  "caveat",
  "cannot conclude",
  "insufficient evidence",
  "depends",
];

const HIGH_CONFIDENCE_MARKERS = [
  "com certeza",
  "sem duvida",
  "obviamente",
  "definitivamente",
  "e claro que",
  "nao ha duvida",
  "certamente",
  "sempre ocorre",
  "certainly",
  "undoubtedly",
  "obviously",
  "definitely",
  "clearly",
  "there is no doubt",
];

const ABSOLUTE_MARKERS = [
  "sempre",
  "nunca",
  "todos",
  "todas",
  "nenhum",
  "nenhuma",
  "jamais",
  "qualquer caso",
  "em todos os casos",
  "always",
  "never",
  "all",
  "none",
  "every case",
  "in all cases",
];

const SOURCE_REFERENCE_MARKERS = [
  "segundo estudos",
  "segundo pesquisas",
  "estudos mostram",
  "pesquisas indicam",
  "a literatura mostra",
  "a ciencia comprova",
  "dados mostram",
  "de acordo com os dados",
  "fonte",
  "fontes",
  "referencia",
  "according to studies",
  "research shows",
  "studies show",
  "data shows",
  "sources say",
  "the literature shows",
];

const NORMATIVE_CLAIM_MARKERS = [
  "lei",
  "norma",
  "edital",
  "portaria",
  "resolucao",
  "regulamento",
  "juridico",
  "legalmente",
  "obrigatorio",
  "proibido",
  "permitido",
  "policy",
  "law",
  "regulation",
  "legally",
  "mandatory",
  "forbidden",
  "allowed",
];

const TEMPORAL_CLAIM_MARKERS = [
  "atualmente",
  "hoje",
  "agora",
  "recente",
  "mais recente",
  "ultima versao",
  "novo",
  "mudou",
  "current",
  "currently",
  "today",
  "now",
  "recent",
  "latest",
  "new version",
  "changed",
];

const SOURCE_REQUEST_MARKERS = [
  "fonte",
  "fontes",
  "referencia",
  "referencias",
  "citacao",
  "citar",
  "abnt",
  "link",
  "comprove",
  "verifique na internet",
  "source",
  "sources",
  "reference",
  "citation",
  "cite",
  "link",
  "prove",
];

const VERIFICATION_REQUEST_MARKERS = [
  "verifique",
  "confirme",
  "tem certeza",
  "avalie se esta certo",
  "cheque",
  "validar",
  "analisar se",
  "verify",
  "confirm",
  "are you sure",
  "check",
  "validate",
];

const USER_MATERIAL_MARKERS = [
  "texto",
  "codigo",
  "arquivo",
  "anexo",
  "imagem",
  "resposta dada",
  "minha resposta",
  "meu texto",
  "este trecho",
  "essa resposta",
  "esse codigo",
  "draft",
  "code",
  "file",
  "attachment",
  "my text",
  "this answer",
  "this excerpt",
];

export function runEvidenceAdvisor(
  input: CouncilInput,
): CouncilAdvisorReport {
  const userInput = input.userInput ?? "";
  const draftAnswer = input.draftAnswer ?? "";

  const normalizedDraft = normalizeText(draftAnswer);
  const breakdown = buildEvidenceBreakdown(normalizedDraft);
  const context = buildEvidenceContext(input);

  const findings = dedupeFindings([
    ...findUnsupportedCertaintyGaps(breakdown, context),
    ...findSourceSupportGaps(breakdown, context, normalizedDraft),
    ...findSeparationGaps(breakdown, context),
    ...findTaskSpecificEvidenceGaps(breakdown, context),
  ]);

  const risk = maxRiskLevel(findings.map((finding) => finding.risk));
  const concerns = dedupeNormalized(findings.map((finding) => finding.id));

  const requiredRevisions = dedupeNormalized(
    findings
      .map((finding) => finding.requiredRevision)
      .filter((revision): revision is string => Boolean(revision)),
  );

  const optionalRevisions = dedupeNormalized(
    findings
      .map((finding) => finding.optionalRevision)
      .filter((revision): revision is string => Boolean(revision)),
  );

  const unsupportedClaims = concerns.filter((concern) =>
    [
      "high_confidence_claim_without_support",
      "claims_external_source_without_retrieved_support",
      "absolute_generalization_without_support",
      "statistics_without_support",
      "normative_or_policy_claim_without_support",
      "temporal_claim_without_current_support",
      "source_marker_without_source",
    ].includes(concern),
  );

  const hardSignals = findings.filter((finding) =>
    isRiskAtLeast(finding.risk, "high"),
  ).length;

  return {
    advisorId: ADVISOR_ID,
    advisorName: ADVISOR_NAME,
    passed: risk === "low",
    risk,
    concerns,
    strengths: risk === "low" ? buildStrengths(breakdown, context) : [],
    requiredRevisions,
    optionalRevisions,
    confidence: confidenceFromSignals(findings.length, hardSignals),
    unsupportedClaims,
  };
}

function buildEvidenceBreakdown(normalizedDraft: string): EvidenceBreakdown {
  return {
    evidenceMarkers: countMarkerOccurrences(normalizedDraft, EVIDENCE_MARKERS),
    inferenceMarkers: countMarkerOccurrences(normalizedDraft, INFERENCE_MARKERS),
    hypothesisMarkers: countMarkerOccurrences(normalizedDraft, HYPOTHESIS_MARKERS),
    opinionMarkers: countMarkerOccurrences(normalizedDraft, OPINION_MARKERS),
    uncertaintyMarkers: countMarkerOccurrences(normalizedDraft, UNCERTAINTY_MARKERS),
    limitationMarkers: countMarkerOccurrences(normalizedDraft, UNCERTAINTY_MARKERS),
    sourceReferenceMarkers: countMarkerOccurrences(
      normalizedDraft,
      SOURCE_REFERENCE_MARKERS,
    ),
    highConfidenceMarkers: countMarkerOccurrences(
      normalizedDraft,
      HIGH_CONFIDENCE_MARKERS,
    ),
    absoluteMarkers: countMarkerOccurrences(normalizedDraft, ABSOLUTE_MARKERS),
    numericClaimMarkers: countNumericClaimMarkers(normalizedDraft),
    temporalClaimMarkers: countMarkerOccurrences(
      normalizedDraft,
      TEMPORAL_CLAIM_MARKERS,
    ),
    normativeClaimMarkers: countMarkerOccurrences(
      normalizedDraft,
      NORMATIVE_CLAIM_MARKERS,
    ),
  };
}

function buildEvidenceContext(input: CouncilInput): EvidenceContext {
  const userInput = input.userInput ?? "";
  const normalizedUser = normalizeText(userInput);

  const retrievedEvidence = getArrayProp(input, "retrievedEvidence");
  const retrievedSources = getArrayProp(input, "retrievedSources");
  const sourceCitations = getArrayProp(input, "citations");

  const hasRetrievedEvidence = retrievedEvidence.length > 0;
  const hasRetrievedSources = retrievedSources.length > 0 || sourceCitations.length > 0;
  const hasExternalSupport = hasRetrievedEvidence || hasRetrievedSources;

  const hasUserProvidedMaterial =
    USER_MATERIAL_MARKERS.some((marker) =>
      normalizedUser.includes(normalizeText(marker)),
    ) || Boolean(input.draftAnswer && userInput.length > 240);

  const userRequestedSources = SOURCE_REQUEST_MARKERS.some((marker) =>
    normalizedUser.includes(normalizeText(marker)),
  );

  const userRequestedVerification = VERIFICATION_REQUEST_MARKERS.some((marker) =>
    normalizedUser.includes(normalizeText(marker)),
  );

  const taskLikelyNeedsExternalSupport =
    userRequestedSources ||
    userRequestedVerification ||
    TEMPORAL_CLAIM_MARKERS.some((marker) =>
      normalizedUser.includes(normalizeText(marker)),
    ) ||
    NORMATIVE_CLAIM_MARKERS.some((marker) =>
      normalizedUser.includes(normalizeText(marker)),
    );

  return {
    hasRetrievedEvidence,
    hasRetrievedSources,
    hasExternalSupport,
    hasUserProvidedMaterial,
    userRequestedSources,
    userRequestedVerification,
    taskLikelyNeedsExternalSupport,
    taskCanRelyOnUserMaterial: hasUserProvidedMaterial && !taskLikelyNeedsExternalSupport,
  };
}

function findUnsupportedCertaintyGaps(
  breakdown: EvidenceBreakdown,
  context: EvidenceContext,
): EvidenceFinding[] {
  const findings: EvidenceFinding[] = [];

  if (
    breakdown.highConfidenceMarkers > 0 &&
    !context.hasExternalSupport &&
    !context.taskCanRelyOnUserMaterial
  ) {
    findings.push({
      id: "high_confidence_claim_without_support",
      risk: "high",
      message:
        "The draft uses high-confidence language without enough support in the available evidence context.",
      requiredRevision:
        "Remove unsupported certainty or add concrete support. Use calibrated language when evidence is limited.",
    });
  }

  if (
    breakdown.absoluteMarkers > 0 &&
    !context.hasExternalSupport &&
    !context.taskCanRelyOnUserMaterial
  ) {
    findings.push({
      id: "absolute_generalization_without_support",
      risk: "medium",
      message:
        "The draft contains absolute generalizations without sufficient support.",
      requiredRevision:
        "Replace absolute language with bounded claims, examples or caveats unless support is available.",
    });
  }

  if (
    breakdown.numericClaimMarkers > 0 &&
    !context.hasExternalSupport &&
    !context.taskCanRelyOnUserMaterial
  ) {
    findings.push({
      id: "statistics_without_support",
      risk: "high",
      message:
        "The draft appears to use numeric or statistical claims without supporting evidence.",
      requiredRevision:
        "Add the source, calculation or data basis for numeric claims, or remove the unsupported numbers.",
    });
  }

  return findings;
}

function findSourceSupportGaps(
  breakdown: EvidenceBreakdown,
  context: EvidenceContext,
  normalizedDraft: string,
): EvidenceFinding[] {
  const findings: EvidenceFinding[] = [];

  if (context.userRequestedSources && !hasCitationLikeMarker(normalizedDraft)) {
    findings.push({
      id: "citation_requested_but_missing",
      risk: "high",
      message:
        "The user requested sources or citations, but the draft does not provide citation-like support.",
      requiredRevision:
        "Add appropriate citations, references or clearly state that no source was available.",
    });
  }

  if (breakdown.sourceReferenceMarkers > 0 && !context.hasExternalSupport) {
    findings.push({
      id: "claims_external_source_without_retrieved_support",
      risk: "high",
      message:
        "The draft refers to studies, sources, data or literature without retrieved support.",
      requiredRevision:
        "Do not claim that external sources support the answer unless sources were actually retrieved or provided.",
    });
  }

  if (
    breakdown.evidenceMarkers > 0 &&
    breakdown.sourceReferenceMarkers === 0 &&
    !context.hasExternalSupport &&
    !context.taskCanRelyOnUserMaterial
  ) {
    findings.push({
      id: "source_marker_without_source",
      risk: "medium",
      message:
        "The draft uses evidence-related language but does not clearly identify the basis of that evidence.",
      optionalRevision:
        "Clarify whether the evidence comes from the user's material, retrieved sources, calculation or reasoning.",
    });
  }

  return findings;
}

function findSeparationGaps(
  breakdown: EvidenceBreakdown,
  context: EvidenceContext,
): EvidenceFinding[] {
  const findings: EvidenceFinding[] = [];

  const hasInferentialContent =
    breakdown.inferenceMarkers > 0 ||
    breakdown.hypothesisMarkers > 0 ||
    breakdown.opinionMarkers > 0;

  const hasEvidenceFraming = breakdown.evidenceMarkers > 0 || context.hasExternalSupport;

  if (hasInferentialContent && !hasEvidenceFraming) {
    findings.push({
      id: "evidence_inference_hypothesis_not_distinguished",
      risk: "medium",
      message:
        "The draft contains inference, hypothesis or opinion markers without clearly separating them from evidence.",
      requiredRevision:
        "Explicitly separate evidence, inference, hypothesis and opinion in the argument.",
    });
  }

  if (
    breakdown.hypothesisMarkers > 0 &&
    breakdown.uncertaintyMarkers === 0 &&
    breakdown.limitationMarkers === 0
  ) {
    findings.push({
      id: "hypothesis_without_uncertainty_boundary",
      risk: "medium",
      message:
        "The draft uses hypothetical framing but does not mark uncertainty boundaries.",
      optionalRevision:
        "When using hypotheses, state what is uncertain, what would confirm it and what should not be concluded yet.",
    });
  }

  if (
    breakdown.opinionMarkers > 0 &&
    breakdown.evidenceMarkers === 0 &&
    breakdown.inferenceMarkers === 0
  ) {
    findings.push({
      id: "opinion_presented_as_fact",
      risk: "medium",
      message:
        "The draft may rely on opinion without making the evidential status clear.",
      requiredRevision:
        "Clarify which parts are opinion, which are inference and which are supported by evidence or the user's material.",
    });
  }

  if (
    hasInferentialContent &&
    !context.hasExternalSupport &&
    !context.taskCanRelyOnUserMaterial &&
    breakdown.uncertaintyMarkers === 0
  ) {
    findings.push({
      id: "weak_evidence_framing",
      risk: "medium",
      message:
        "The evidential framing is weak for a response that includes inferential content.",
      optionalRevision:
        "Add calibrated language that distinguishes what is known, inferred and uncertain.",
    });
  }

  return findings;
}

function findTaskSpecificEvidenceGaps(
  breakdown: EvidenceBreakdown,
  context: EvidenceContext,
): EvidenceFinding[] {
  const findings: EvidenceFinding[] = [];

  if (
    breakdown.normativeClaimMarkers > 0 &&
    !context.hasExternalSupport &&
    !context.taskCanRelyOnUserMaterial
  ) {
    findings.push({
      id: "normative_or_policy_claim_without_support",
      risk: "high",
      message:
        "The draft makes legal, policy, regulatory or normative claims without adequate support.",
      requiredRevision:
        "Support normative claims with the relevant text, source, document or clearly mark them as general guidance.",
    });
  }

  if (
    breakdown.temporalClaimMarkers > 0 &&
    !context.hasExternalSupport &&
    !context.taskCanRelyOnUserMaterial
  ) {
    findings.push({
      id: "temporal_claim_without_current_support",
      risk: "high",
      message:
        "The draft makes current or recently changing claims without current support.",
      requiredRevision:
        "Remove claims about current status or add current evidence. If current evidence is unavailable, state the limitation.",
    });
  }

  return findings;
}

function buildStrengths(
  breakdown: EvidenceBreakdown,
  context: EvidenceContext,
): string[] {
  const strengths = [
    "Claim support and inferential framing are sufficiently explicit for the available context.",
  ];

  if (context.hasExternalSupport) {
    strengths.push("The answer has retrieved or provided support available in the evidence context.");
  }

  if (breakdown.uncertaintyMarkers > 0 || breakdown.limitationMarkers > 0) {
    strengths.push("The draft includes uncertainty or limitation markers.");
  }

  if (breakdown.inferenceMarkers > 0 && breakdown.evidenceMarkers > 0) {
    strengths.push("The draft shows both evidence and inference framing.");
  }

  return dedupeNormalized(strengths);
}

function countMarkerOccurrences(
  normalizedText: string,
  markers: readonly string[],
): number {
  let count = 0;

  for (const marker of markers) {
    const normalizedMarker = normalizeText(marker);

    if (!normalizedMarker) {
      continue;
    }

    if (normalizedMarker.includes(" ")) {
      if (normalizedText.includes(normalizedMarker)) {
        count += 1;
      }

      continue;
    }

    const regex = new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`, "g");
    count += normalizedText.match(regex)?.length ?? 0;
  }

  return count;
}

function countNumericClaimMarkers(normalizedText: string): number {
  const percentageMatches = normalizedText.match(/\b\d+(?:[.,]\d+)?\s*%/g) ?? [];
  const statisticWords =
    normalizedText.match(
      /\b(media|mediana|desvio|variancia|amostra|percentual|taxa|indice|probabilidade|correlacao|mean|median|variance|sample|rate|index|probability|correlation)\b/g,
    ) ?? [];

  return percentageMatches.length + statisticWords.length;
}

function hasCitationLikeMarker(normalizedDraft: string): boolean {
  return (
    /\[[^\]]+\]/.test(normalizedDraft) ||
    /\([a-z]+,\s*\d{4}\)/i.test(normalizedDraft) ||
    /\bhttps?:\/\//i.test(normalizedDraft) ||
    /\bdoi\b/i.test(normalizedDraft) ||
    /\bfonte\b/.test(normalizedDraft) ||
    /\bsource\b/.test(normalizedDraft)
  );
}

function dedupeFindings(
  findings: readonly EvidenceFinding[],
): EvidenceFinding[] {
  const byId = new Map<EvidenceConcernId, EvidenceFinding>();

  for (const finding of findings) {
    const previous = byId.get(finding.id);

    if (!previous) {
      byId.set(finding.id, finding);
      continue;
    }

    byId.set(finding.id, {
      ...previous,
      risk: maxRiskLevel([previous.risk, finding.risk]),
      requiredRevision:
        previous.requiredRevision ?? finding.requiredRevision,
      optionalRevision:
        previous.optionalRevision ?? finding.optionalRevision,
    });
  }

  return Array.from(byId.values());
}

function getArrayProp(source: unknown, key: string): unknown[] {
  if (!isRecord(source)) {
    return [];
  }

  const value = source[key];

  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}