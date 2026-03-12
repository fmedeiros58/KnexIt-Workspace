import type { ConversationChatHistoryItem, PersistentInstructionState } from "./types";

const STYLE_RULES: Array<{ pattern: RegExp; style: string }> = [
  { pattern: /\b(par[aá]grafo|texto corrido|sem t[oó]picos|sem bullets)\b/i, style: "texto corrido em paragrafos coesos" },
  { pattern: /\b(lista|bullet|t[oó]picos)\b/i, style: "resposta em lista objetiva" },
  { pattern: /\b(curta|curto|breve|resumo)\b/i, style: "resposta breve e objetiva" },
  { pattern: /\b(detalhad[ao]|aprofundad[ao]|completo)\b/i, style: "resposta aprofundada e articulada" },
  { pattern: /\b(passo a passo)\b/i, style: "explicacao sequencial passo a passo" },
  { pattern: /\b(json)\b/i, style: "saida em JSON valido" },
];

const RESPONSE_MODE_RULES: Array<{ pattern: RegExp; mode: string }> = [
  { pattern: /\b(reescrev|reescrever|refa[cç]a|ajustar|melhorar)\b/i, mode: "editing" },
  { pattern: /\b(explique|explicar|aprofunde|detalhe)\b/i, mode: "analysis" },
  { pattern: /\b(resuma|resumo|sintetize)\b/i, mode: "summary" },
  { pattern: /\b(c[oó]digo|implemente|patch|refator)\b/i, mode: "implementation" },
];

const CONSTRAINT_CAPTURE_PATTERNS = [
  /\b(?:nao|não|sem)\s+([^.!\n]{3,120})/gi,
  /\b(?:apenas|somente)\s+([^.!\n]{3,120})/gi,
  /\b(?:evite|proibido)\s+([^.!\n]{3,120})/gi,
];

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeConstraint(fragment: string) {
  const normalized = compactText(fragment);
  if (!normalized) return "";
  const cleaned = normalized.replace(/[;,.]+$/g, "").trim();
  if (cleaned.length <= 120) return cleaned;
  return `${cleaned.slice(0, 117).trimEnd()}...`;
}

function parseConstraints(text: string) {
  const constraints: string[] = [];
  for (const pattern of CONSTRAINT_CAPTURE_PATTERNS) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const candidate = normalizeConstraint(match[1] || "");
      if (candidate) constraints.push(candidate);
    }
  }
  return constraints;
}

function dedupe(values: string[], limit: number) {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= limit) break;
  }
  return output;
}

function resolveRequiredStyle(messages: string[], previousStyle: string) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    for (const rule of STYLE_RULES) {
      if (rule.pattern.test(message)) return rule.style;
    }
  }
  return previousStyle || "resposta contextualizada e natural";
}

function resolveResponseMode(messages: string[], previousMode: string) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    for (const rule of RESPONSE_MODE_RULES) {
      if (rule.pattern.test(message)) return rule.mode;
    }
  }
  return previousMode || "conversation";
}

export function resolveInstructionPersistence(input: {
  prompt: string;
  history: ConversationChatHistoryItem[];
  previous: PersistentInstructionState | null;
}): PersistentInstructionState {
  const userMessages = input.history
    .filter((item) => item.role === "user")
    .slice(-12)
    .map((item) => compactText(item.content))
    .filter(Boolean);
  userMessages.push(compactText(input.prompt));

  const requestedReset = /desconsidere (as )?instru[cç][oõ]es anteriores/i.test(input.prompt);
  const previousConstraints = requestedReset ? [] : input.previous?.userConstraints || [];
  const parsedConstraints = userMessages.flatMap((message) => parseConstraints(message));
  const userConstraints = dedupe([...previousConstraints, ...parsedConstraints], 10);

  const requiredStyle = resolveRequiredStyle(userMessages, requestedReset ? "" : input.previous?.requiredStyle || "");
  const responseMode = resolveResponseMode(userMessages, requestedReset ? "" : input.previous?.responseMode || "");
  return {
    requiredStyle,
    userConstraints,
    responseMode,
  };
}

