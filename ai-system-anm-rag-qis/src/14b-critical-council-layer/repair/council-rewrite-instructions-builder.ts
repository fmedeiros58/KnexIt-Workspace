import type { CouncilRevisionPlan } from "../council-types";

interface RewriteInstructionLimits {
  readonly revisionGoals: number;
  readonly constraints: number;
  readonly rewriteInstructions: number;
  readonly antiSycophancyInstructions: number;
  readonly logicInstructions: number;
  readonly evidenceInstructions: number;
  readonly toneInstructions: number;
}

interface RewriteInstructionOptions {
  readonly limits?: Partial<RewriteInstructionLimits>;
  readonly compact?: boolean;
}

const DEFAULT_LIMITS: RewriteInstructionLimits = {
  revisionGoals: 5,
  constraints: 6,
  rewriteInstructions: 6,
  antiSycophancyInstructions: 3,
  logicInstructions: 3,
  evidenceInstructions: 3,
  toneInstructions: 3,
};

const ASK_CLARIFICATION_MARKERS = [
  "clarify",
  "clarification",
  "missing premises",
  "ask only the minimum",
  "esclarecer",
  "esclarecimento",
  "premissas ausentes",
];

const BLOCK_DELIVERY_MARKERS = [
  "block delivery",
  "do not deliver",
  "blocking risks",
  "bloquear",
  "nao entregar",
  "não entregar",
  "risco bloqueante",
];

const CAVEAT_MARKERS = [
  "caveat",
  "uncertain",
  "uncertainty",
  "limitation",
  "ressalva",
  "incerteza",
  "limite",
  "limitacao",
  "limitação",
];

export function buildCouncilRewriteInstructions(
  plan: CouncilRevisionPlan,
  options: RewriteInstructionOptions = {},
): string {
  const limits = {
    ...DEFAULT_LIMITS,
    ...(options.limits ?? {}),
  };

  const sections: string[] = [];

  appendBaseInstruction(sections, plan);
  appendRegenerationOrRevisionMode(sections, plan);
  appendSection(
    sections,
    "Revision goals",
    getTop(plan.revisionGoals, limits.revisionGoals),
  );
  appendSection(
    sections,
    "Constraints to preserve",
    getTop(plan.constraintsToPreserve, limits.constraints),
  );
  appendSection(
    sections,
    "Anti-sycophancy requirements",
    getTop(
      plan.antiSycophancyInstructions,
      limits.antiSycophancyInstructions,
    ),
  );
  appendSection(
    sections,
    "Logical requirements",
    getTop(plan.logicInstructions, limits.logicInstructions),
  );
  appendSection(
    sections,
    "Evidence requirements",
    getTop(plan.evidenceInstructions, limits.evidenceInstructions),
  );
  appendSection(
    sections,
    "Tone and communication requirements",
    getTop(plan.toneInstructions, limits.toneInstructions),
  );
  appendSection(
    sections,
    "Mandatory fixes",
    getTop(plan.rewriteInstructions, limits.rewriteInstructions),
  );
  appendFinalInstruction(sections, plan);

  const cleanedSections = dedupe(
    sections
      .map((section) => normalizeInstructionLine(section))
      .filter(Boolean),
  );

  return options.compact
    ? cleanedSections.join(" ")
    : cleanedSections.join("\n");
}

function appendBaseInstruction(
  sections: string[],
  plan: CouncilRevisionPlan,
): void {
  sections.push(
    "Rewrite the answer in the user's dominant language and preserve the original task objective.",
  );

  if (hasAnyInstruction(plan)) {
    sections.push(
      "Apply the Council revision plan as binding guidance. Do not ignore required revisions, unresolved constraints or category-specific instructions.",
    );
  }
}

function appendRegenerationOrRevisionMode(
  sections: string[],
  plan: CouncilRevisionPlan,
): void {
  if (plan.regenerationRequired) {
    sections.push(
      "Mode: regenerate. Rebuild the full draft from scratch, preserving only validated constraints, valid reasoning, supported claims and the user's original objective.",
    );
    return;
  }

  if (plan.revisionRequired) {
    sections.push(
      "Mode: revise. Keep valid parts of the draft, but correct the Council findings before final delivery.",
    );
    return;
  }

  sections.push(
    "Mode: preserve and polish. Avoid unnecessary rewriting, but do not introduce new unsupported claims.",
  );
}

function appendSection(
  sections: string[],
  title: string,
  values: readonly string[],
): void {
  const cleaned = dedupe(
    values
      .map((value) => normalizeInstructionLine(value))
      .filter(Boolean),
  );

  if (cleaned.length === 0) {
    return;
  }

  sections.push(`${title}: ${cleaned.join(" | ")}`);
}

function appendFinalInstruction(
  sections: string[],
  plan: CouncilRevisionPlan,
): void {
  const allInstructions = collectAllPlanInstructions(plan);

  if (containsAny(allInstructions, BLOCK_DELIVERY_MARKERS)) {
    sections.push(
      "Finalization rule: do not produce a final answer until blocking risks are resolved. If delivery is impossible, return a brief explanation of the unresolved blocking issue.",
    );
    return;
  }

  if (containsAny(allInstructions, ASK_CLARIFICATION_MARKERS)) {
    sections.push(
      "Finalization rule: ask only the minimum necessary clarification question and explain why that information is required.",
    );
    return;
  }

  if (containsAny(allInstructions, CAVEAT_MARKERS)) {
    sections.push(
      "Finalization rule: include explicit caveats for uncertain claims, but keep supported conclusions direct and useful.",
    );
    return;
  }

  sections.push(
    "Finalization rule: finish with a clear conclusion that follows from the revised reasoning, survives counterpoint and preserves the user's constraints.",
  );
}

function getTop(values: readonly string[] | undefined, size: number): string[] {
  const safeSize = Math.max(0, Math.floor(Number.isFinite(size) ? size : 0));

  if (!values || safeSize === 0) {
    return [];
  }

  return dedupe(
    values
      .map((value) => normalizeInstructionLine(value))
      .filter(Boolean),
  ).slice(0, safeSize);
}

function collectAllPlanInstructions(plan: CouncilRevisionPlan): string {
  return [
    ...(plan.revisionGoals ?? []),
    ...(plan.rewriteInstructions ?? []),
    ...(plan.constraintsToPreserve ?? []),
    ...(plan.toneInstructions ?? []),
    ...(plan.evidenceInstructions ?? []),
    ...(plan.logicInstructions ?? []),
    ...(plan.antiSycophancyInstructions ?? []),
  ]
    .map((value) => normalizeInstructionLine(value))
    .join(" ");
}

function hasAnyInstruction(plan: CouncilRevisionPlan): boolean {
  return (
    (plan.revisionGoals ?? []).length > 0 ||
    (plan.rewriteInstructions ?? []).length > 0 ||
    (plan.constraintsToPreserve ?? []).length > 0 ||
    (plan.toneInstructions ?? []).length > 0 ||
    (plan.evidenceInstructions ?? []).length > 0 ||
    (plan.logicInstructions ?? []).length > 0 ||
    (plan.antiSycophancyInstructions ?? []).length > 0
  );
}

function containsAny(text: string, markers: readonly string[]): boolean {
  const normalizedText = normalizeText(text);

  return markers.some((marker) =>
    normalizedText.includes(normalizeText(marker)),
  );
}

function normalizeInstructionLine(value: string): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function normalizeText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = normalizeInstructionLine(value);
    const key = normalizeText(cleaned);

    if (!cleaned || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}