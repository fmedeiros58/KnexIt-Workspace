import type {
  TranslationInput,
  TranslationOutput,
  TranslationProvider,
} from "../../types";

const PT_EN: Record<string, string> = {
  educacao: "education",
  inclusao: "inclusion",
  universidade: "university",
  trabalho: "work",
  disciplina: "course",
  aluno: "student",
  curso: "course",
  pesquisa: "research",
  resumo: "summary",
  introducao: "introduction",
  conclusao: "conclusion",
};

const EN_PT: Record<string, string> = {
  education: "educacao",
  inclusion: "inclusao",
  university: "universidade",
  student: "aluno",
  research: "pesquisa",
  summary: "resumo",
  introduction: "introducao",
  conclusion: "conclusao",
};

function normalizeToken(token: string) {
  return token
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function translateToken(token: string, table: Record<string, string>) {
  const normalized = normalizeToken(token.replace(/[^\p{L}\p{N}]/gu, ""));
  const translated = table[normalized];
  if (!translated) return token;
  const suffix = token.match(/[^\p{L}\p{N}]+$/u)?.[0] ?? "";
  return `${translated}${suffix}`;
}

function translateWithTable(text: string, table: Record<string, string>) {
  const tokens = text.split(/\s+/);
  const translated = tokens.map((token) => translateToken(token, table)).join(" ");
  return translated.trim();
}

function detectTable(targetLanguage: string) {
  const lowered = targetLanguage.toLowerCase();
  if (lowered.startsWith("en")) return PT_EN;
  if (lowered.startsWith("pt")) return EN_PT;
  return null;
}

function applyTerminology(output: string, terminology?: Record<string, string>) {
  if (!terminology) return output;
  return Object.entries(terminology).reduce((acc, [source, replacement]) => {
    if (!source.trim()) return acc;
    return acc.replace(new RegExp(source, "gi"), replacement);
  }, output);
}

async function translate(input: TranslationInput): Promise<TranslationOutput> {
  const table = detectTable(input.targetLanguage);
  let translated = input.text;

  if (table) {
    translated = translateWithTable(input.text, table);
  }

  translated = applyTerminology(translated, input.context?.terminology);

  return {
    translatedText: translated,
    providerId: "local-cpu-mock",
    confidence: 0.62,
    detectedLanguage: input.sourceLanguage,
  };
}

export const localTranslationProvider: TranslationProvider = {
  id: "local-cpu-mock",
  name: "Local CPU Mock",
  runtime: ["desktop", "pwa", "web"],
  supportsOffline: true,
  supportsBatch: true,
  translate,
};
