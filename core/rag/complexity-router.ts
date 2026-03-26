export type ComplexityMode = "lite" | "full";

export type ComplexityDecision = {
  mode: ComplexityMode;
  score: number;
  reasons: string[];
  hardRule: string | null;
  policyOverrides: string[];
  textChars: number;
  textWords: number;
};

export type ComplexityRouterInput = {
  text: string;
  hasAttachments: boolean;
  hasDocumentScope: boolean;
  hasConversationContext: boolean;
};

const TASK_TERMS = [
  "analise",
  "analisar",
  "analisar",
  "crie",
  "implemente",
  "plano",
  "roteiro",
  "refatore",
  "resuma",
  "compare",
  "explique em detalhes",
  "estruture",
  "arquitetura",
  "codigo",
  "código",
  "patch",
  "prompt",
  "tese",
  "capitulo",
  "capítulo",
];

const CODE_AND_ARCHITECTURE_TERMS = [
  "codigo",
  "código",
  "patch",
  "arquitetura",
  "refatore",
  "implemente",
  "api",
  "endpoint",
];

const ERROR_TERMS = [
  "erro",
  "error",
  "exception",
  "stacktrace",
  "stack trace",
  "traceback",
  "log",
  "falha",
  "timeout",
  "econnrefused",
  "5xx",
];

const RESEARCH_TERMS = [
  "verifique link",
  "cite fontes",
  "pesquise",
  "fonte confiavel",
  "fonte confiável",
  "referencia",
  "referência",
];

const FACTUAL_GROUNDING_TERMS = [
  "capital",
  "presidente",
  "governador",
  "prefeito",
  "ceo",
  "colesterol",
  "diabetes",
  "sintoma",
  "tratamento",
  "estado",
  "cidade",
  "pais",
  "paÃ­s",
];

const MULTI_STEP_TERMS = ["passo a passo", "pipeline", "workflow", "roadmap", "checklist"];

const PROJECT_CONTEXT_TERMS = [
  "no meu projeto",
  "como falamos",
  "na knex",
  "no codex",
  "no backend",
  "no servidor",
  "neste projeto",
];

const GREETING_SET = new Set(["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite"]);
const ACK_SET = new Set(["ok", "blz", "beleza", "entendi", "valeu", "thanks", "obrigado", "obg"]);
const YES_NO_SET = new Set(["sim", "nao", "não"]);

function normalizeText(value: string) {
  return `${value || ""}`
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => {
    const candidate = `${term || ""}`.trim().toLowerCase();
    if (!candidate) return false;
    if (candidate.includes(" ")) {
      return text.includes(candidate);
    }
    return new RegExp(`\\b${escapeRegex(candidate)}\\b`).test(text);
  });
}

function countSentences(rawText: string) {
  const fragments = rawText
    .split(/[.!?]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return fragments.length;
}

function countWords(text: string) {
  return text.split(/\s+/g).filter(Boolean).length;
}

function containsMultiRequestSignals(text: string) {
  const tokens = [" alem disso", " além disso", " tambem", " também", " ainda", " em seguida", " e "];
  return tokens.reduce((count, token) => count + (text.includes(token) ? 1 : 0), 0) >= 2;
}

function isSingleAck(text: string, chars: number) {
  return chars <= 20 && ACK_SET.has(text);
}

function isSingleGreeting(text: string, chars: number) {
  return chars <= 20 && GREETING_SET.has(text);
}

function isTwoWordMicroReply(text: string, hasQuestionMark: boolean, hasTaskTerm: boolean) {
  const words = text.split(/\s+/g).filter(Boolean);
  return words.length >= 1 && words.length <= 2 && !hasQuestionMark && !hasTaskTerm;
}

function isShortAdjustWithoutContext(text: string, chars: number) {
  if (chars > 30) return false;
  return text.includes("ajuste isso");
}

function isShortFactualQuestion(text: string, hasQuestionMark: boolean, words: number, hasTaskTerm: boolean) {
  if (!hasQuestionMark) return false;
  if (words <= 0 || words > 8) return false;
  if (hasTaskTerm) return false;
  if (hasAnyTerm(text, CODE_AND_ARCHITECTURE_TERMS)) return false;
  if (hasAnyTerm(text, ERROR_TERMS)) return false;
  if (hasAnyTerm(text, RESEARCH_TERMS)) return false;
  return /^(qual|que|quem|onde|quando|como|what|who|where|when|how)\b/.test(text);
}

export function routeComplexity(input: ComplexityRouterInput): ComplexityDecision {
  const rawText = `${input.text || ""}`.trim();
  const text = normalizeText(rawText);
  const chars = rawText.length;
  const words = countWords(text);
  const hasQuestionMark = rawText.includes("?");
  const sentenceCount = countSentences(rawText);
  const hasTaskTerm = hasAnyTerm(text, TASK_TERMS);
  const reasons: string[] = [];
  const policyOverrides: string[] = [];

  const hardForceFull =
    input.hasAttachments ||
    input.hasDocumentScope ||
    hasAnyTerm(text, CODE_AND_ARCHITECTURE_TERMS) ||
    hasAnyTerm(text, ERROR_TERMS) ||
    hasAnyTerm(text, RESEARCH_TERMS);
  if (hardForceFull) {
    if (input.hasAttachments || input.hasDocumentScope) reasons.push("HARD_FULL_ATTACHMENT_OR_DOCUMENT_SCOPE");
    if (hasAnyTerm(text, CODE_AND_ARCHITECTURE_TERMS)) reasons.push("HARD_FULL_CODE_OR_ARCH");
    if (hasAnyTerm(text, ERROR_TERMS)) reasons.push("HARD_FULL_ERROR_LOG");
    if (hasAnyTerm(text, RESEARCH_TERMS)) reasons.push("HARD_FULL_RESEARCH_OR_CITATION");
    return {
      mode: "full",
      score: 100,
      reasons,
      hardRule: "FORCE_FULL",
      policyOverrides,
      textChars: chars,
      textWords: words,
    };
  }

  const hardForceLite = chars <= 25 && !hasQuestionMark && !hasTaskTerm;
  if (hardForceLite) {
    reasons.push("HARD_LITE_SHORT_NON_TASK");
    policyOverrides.push("SKIP_MEMORY");
    policyOverrides.push("SKIP_RAG");
    policyOverrides.push("LOW_BUDGET");
    return {
      mode: "lite",
      score: -100,
      reasons,
      hardRule: "FORCE_LITE",
      policyOverrides,
      textChars: chars,
      textWords: words,
    };
  }

  let score = 0;
  if (hasTaskTerm) {
    score += 6;
    reasons.push("TASK_TERM:+6");
  }
  if (hasQuestionMark) {
    score += 5;
    reasons.push("QUESTION_MARK:+5");
  }
  if (sentenceCount >= 2) {
    score += 4;
    reasons.push("MULTI_SENTENCE:+4");
  }
  if (containsMultiRequestSignals(` ${text} `)) {
    score += 4;
    reasons.push("MULTI_REQUEST:+4");
  }
  if (chars > 200) {
    score += 3;
    reasons.push("LEN_GT_200:+3");
  } else if (chars > 80) {
    score += 2;
    reasons.push("LEN_GT_80:+2");
  }
  if (hasAnyTerm(text, PROJECT_CONTEXT_TERMS)) {
    score += 3;
    reasons.push("PROJECT_CONTEXT:+3");
  }
  if (hasAnyTerm(text, MULTI_STEP_TERMS)) {
    score += 4;
    reasons.push("MULTI_STEP:+4");
  }

  if (isSingleGreeting(text, chars)) {
    score -= 10;
    reasons.push("SHORT_GREETING:-10");
  }
  if (isSingleAck(text, chars)) {
    score -= 6;
    reasons.push("SHORT_ACK:-6");
  }
  if (isTwoWordMicroReply(text, hasQuestionMark, hasTaskTerm)) {
    score -= 6;
    reasons.push("TWO_WORD_MICRO:-6");
  }
  if (input.hasConversationContext && chars <= 10 && YES_NO_SET.has(text)) {
    score -= 4;
    reasons.push("YES_NO_CONTINUATION:-4");
  }
  if (isShortAdjustWithoutContext(text, chars)) {
    score -= 5;
    reasons.push("SHORT_ADJUST_WITHOUT_CONTEXT:-5");
    policyOverrides.push("ASK_MIN_CONTEXT");
  }
  if (isShortFactualQuestion(text, hasQuestionMark, words, hasTaskTerm)) {
    score -= 2;
    reasons.push("SHORT_FACTUAL_QUESTION:-2");
    if (hasAnyTerm(text, FACTUAL_GROUNDING_TERMS)) {
      score += 4;
      reasons.push("FACTUAL_GROUNDING:+4");
    }
  }

  const mode: ComplexityMode = score <= 0 ? "lite" : "full";
  if (mode === "lite") {
    policyOverrides.push("SKIP_MEMORY");
    policyOverrides.push("SKIP_RAG");
    policyOverrides.push("LOW_BUDGET");
  }
  return {
    mode,
    score,
    reasons,
    hardRule: null,
    policyOverrides,
    textChars: chars,
    textWords: words,
  };
}
