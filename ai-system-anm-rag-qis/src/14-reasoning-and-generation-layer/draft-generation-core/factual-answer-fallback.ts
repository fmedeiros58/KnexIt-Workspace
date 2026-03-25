/**
 * Responsabilidade do arquivo:
 * - Detectar perguntas factuais diretas de nome por cargo/localidade.
 * - Extrair resposta curta a partir de snippets recuperados no knowledge-layer.
 * - Fornecer fallback factual objetivo para evitar respostas meta-estruturais.
 */
import type { RetrievedSource } from "../../bridges/contracts/processing-state";
import { extractLatestUserUtterance, isInternalReasoningArtifact } from "../../shared/utils/conversation-signals";

export interface FactualAnswerFallbackInput {
  question: string;
  sources: RetrievedSource[];
}

export interface FactualAnswerFallbackResult {
  answer: string;
  citations: string[];
  confidence: number;
  role: "governador" | "presidente" | "prefeito";
  place: string;
  personName: string;
}

interface ParsedRoleQuestion {
  role: "governador" | "presidente" | "prefeito";
  placeNormalized: string;
  placeDisplay: string;
}

function decodeHtmlEntities(value: string): string {
  return `${value || ""}`
    .replace(/&#(\d+);/g, (_, decimal) => {
      const code = Number(decimal);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function normalize(value: string): string {
  return decodeHtmlEntities(`${value || ""}`)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeWords(value: string): string {
  return value
    .split(/\s+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizePlace(value: string): string {
  return normalize(value)
    .replace(/\b(?:estado|state)\s+(?:do|da|de)\s+/g, "")
    .replace(/\b(?:estado|state)\s+/g, "")
    .replace(/\b(?:pensou|leitura|evidencia|sequencia|raciocinio|q-branch|status|suporte)\b[\s\S]*$/g, "")
    .replace(/^(?:do|da|de|o|a)\s+/g, "")
    .replace(/\b(?:\?|\.|,|;|:)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getQuestionFocus(question: string): string {
  const focused = extractLatestUserUtterance(question);
  if (!focused) return `${question || ""}`.trim();

  const cleanedLines = `${question || ""}`
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isInternalReasoningArtifact(line));
  if (!cleanedLines.length) return focused;

  const nonNoiseQuestions = cleanedLines.filter((line) => line.includes("?"));
  if (nonNoiseQuestions.length > 0) return nonNoiseQuestions[nonNoiseQuestions.length - 1];
  return focused;
}

function parseGovernorQuestion(question: string): ParsedRoleQuestion | null {
  const focus = getQuestionFocus(question);
  const normalized = normalize(focus);
  if (!/\bgovernador\b/.test(normalized)) return null;

  const candidates: string[] = [];
  const patterns = [
    /\bqual(?:\s+e)?\s+o?\s*nome\s+do\s+governador\s+(?:do|da)\s+([\p{L}\s-]{2,})/gu,
    /\bquem\s+e\s+o?\s*governador\s+(?:do|da)\s+([\p{L}\s-]{2,})/gu,
    /\bgovernador\s+(?:do|da)\s+([\p{L}\s-]{2,})/gu,
  ];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const place = match[1]?.trim();
      if (!place) continue;
      candidates.push(place);
    }
  }

  if (!candidates.length) return null;
  const placeNormalized = normalizePlace(candidates[candidates.length - 1]);
  if (!placeNormalized) return null;
  return {
    role: "governador",
    placeNormalized,
    placeDisplay: capitalizeWords(placeNormalized),
  };
}

function parseMayorQuestion(question: string): ParsedRoleQuestion | null {
  const focus = getQuestionFocus(question);
  const normalized = normalize(focus);
  if (!/\bprefeit[oa]\b/.test(normalized)) return null;

  const candidates: string[] = [];
  const patterns = [
    /\bqual(?:\s+e)?\s+o?\s*nome\s+do\s+prefeit[oa]\s+(?:de|do|da)\s+([\p{L}\s-]{2,})/gu,
    /\bquem\s+e\s+o?\s*prefeit[oa]\s+(?:de|do|da)\s+([\p{L}\s-]{2,})/gu,
    /\bprefeit[oa]\s+(?:de|do|da)\s+([\p{L}\s-]{2,})/gu,
  ];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const place = match[1]?.trim();
      if (!place) continue;
      candidates.push(place);
    }
  }

  if (!candidates.length) return null;
  const placeNormalized = normalizePlace(candidates[candidates.length - 1]);
  if (!placeNormalized) return null;
  return {
    role: "prefeito",
    placeNormalized,
    placeDisplay: capitalizeWords(placeNormalized),
  };
}

function normalizePresidentPlace(value: string): { normalized: string; display: string } {
  const place = normalizePlace(value);
  if (!place) return { normalized: "", display: "" };
  if (/\b(eua|usa|estados unidos|estados unidos da america)\b/.test(place)) {
    return { normalized: "estados unidos", display: "Estados Unidos" };
  }
  if (/\bbrasil\b/.test(place)) {
    return { normalized: "brasil", display: "Brasil" };
  }
  return { normalized: place, display: capitalizeWords(place) };
}

function parsePresidentQuestion(question: string): ParsedRoleQuestion | null {
  const focus = getQuestionFocus(question);
  const normalized = normalize(focus);
  if (!/\bpresidente\b/.test(normalized)) return null;

  const candidates: string[] = [];
  const patterns = [
    /\bqual(?:\s+e)?\s+o?\s*nome\s+do\s+presidente(?:\s+atual)?\s+(?:dos|das|do|da|de)\s+([\p{L}\s-]{2,})/gu,
    /\bquem\s+e\s+o?\s*presidente(?:\s+atual)?\s+(?:dos|das|do|da|de)\s+([\p{L}\s-]{2,})/gu,
    /\bpresidente(?:\s+atual)?\s+(?:dos|das|do|da|de)\s+([\p{L}\s-]{2,})/gu,
  ];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const place = match[1]?.trim();
      if (!place) continue;
      candidates.push(place);
    }
  }

  const resolved = normalizePresidentPlace(candidates[candidates.length - 1] || "");
  if (!resolved.normalized) return null;
  return {
    role: "presidente",
    placeNormalized: resolved.normalized,
    placeDisplay: resolved.display,
  };
}

function parseRoleQuestion(question: string): ParsedRoleQuestion | null {
  return parseGovernorQuestion(question) || parseMayorQuestion(question) || parsePresidentQuestion(question);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanName(value: string): string {
  return value
    .replace(/^\s*(?:e|eh|é)\s+/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(pp|pl|pt|psd|mdb|psdb|uniao)\b/gi, " ")
    .replace(/\b(governador|governadora|vice-governador|vice-governadora|presidente)\b/gi, " ")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimNameTail(value: string): string {
  const connectorWords = new Set(["da", "de", "do", "dos", "das", "e"]);
  const stopWords = new Set([
    "esta", "esta", "retornando", "retorna", "retornou", "foi", "sera", "sera", "e", "e",
    "como", "para", "com", "em", "desde", "when", "is", "the", "novo", "new", "atual",
    "empossado", "empossada", "eleito", "eleita", "tomou", "toma", "apos", "após",
    "juramento", "cargo", "mandato", "cerimonia", "cerimônia", "capitolio", "capitólio",
    "washington", "retorna", "retornando", "anos", "ano",
  ]);
  const words = value.split(/\s+/g).filter(Boolean);
  const selected: string[] = [];
  for (const word of words) {
    const normalized = normalize(word);
    if (selected.length >= 2 && stopWords.has(normalized)) break;
    if (
      selected.length >= 2 &&
      !connectorWords.has(normalized) &&
      !/^[A-ZÀ-ÖØ-Ý]/u.test(word)
    ) {
      break;
    }
    selected.push(word);
    if (selected.length >= 5) break;
  }
  return selected.join(" ");
}

function isValidPersonName(value: string, placeNormalized: string, role: ParsedRoleQuestion["role"]): boolean {
  if (!value) return false;
  const words = value.split(/\s+/g).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  const connectorWords = new Set(["da", "de", "do", "dos", "das", "e"]);
  const invalid = new Set([
    "o", "a", "e", "eh", "de", "do", "da", "dos", "das",
    "governador", "governadora", "presidente", "atual",
    "anuncia", "apoio", "cargo", "retornando", "novo", "lista",
    "apos", "ate", "quatro", "anos", "ano", "mandato", "juramento",
    "cerimonia", "capitolio", "washington", "detalhada", "titulo",
    "head", "chief", "office", "state", "used",
    "resposta", "wikipedia", "enciclopedia",
  ]);
  const placeTokens = placeNormalized
    .split(/\s+/g)
    .filter(Boolean)
    .filter((token) => !invalid.has(token));
  if (
    words.some((word) => {
      const normalizedWord = normalize(word);
      if (connectorWords.has(normalizedWord)) return false;
      return invalid.has(normalizedWord) || placeTokens.includes(normalizedWord);
    })
  ) return false;
  const lexicalWords = words.filter((word) => !connectorWords.has(normalize(word)));
  if (lexicalWords.length < 2) return false;
  if (words.some((word) => /\d/.test(word))) return false;
  const capitalizedCount = words.filter((word) => /^[A-ZÀ-ÖØ-Ý]/u.test(word)).length;
  if (capitalizedCount < 2) return false;
  if (role === "presidente" && words.every((word) => word.length <= 2)) return false;
  return true;
}

function extractGovernorNameFromSnippet(placeNormalized: string, snippet: string): string | null {
  const rawSnippet = decodeHtmlEntities(snippet);
  const normalizedSnippet = normalize(rawSnippet);
  const placeMentioned =
    normalizedSnippet.includes(`governador do ${placeNormalized}`) ||
    normalizedSnippet.includes(`governador do estado do ${placeNormalized}`) ||
    normalizedSnippet.includes(`governador do estado da ${placeNormalized}`);
  if (!placeMentioned) return null;

  const escapedPlace = escapeRegExp(placeNormalized).replace(/\s+/g, "\\s+");
  const placePattern = `(?:estado\\s+do\\s+|estado\\s+da\\s+)?${escapedPlace}`;
  const patterns = [
    new RegExp(`governador\\s+do\\s+${placePattern}\\s*[,:-]\\s*([^,.;\\n]{3,90})`, "i"),
    new RegExp(`governador\\s+do\\s+${placePattern}\\s+(?:e|eh|é)\\s+([^,.;\\n]{3,90})`, "i"),
    new RegExp(`([^,.;\\n]{3,90})\\s+(?:e|eh|é)\\s+o\\s+governador\\s+do\\s+${placePattern}`, "i"),
    new RegExp(`([^,.;\\n]{3,90})\\s*,\\s*o\\s+governador\\s+do\\s+${placePattern}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = rawSnippet.match(pattern);
    if (!match?.[1]) continue;
    const candidate = cleanName(trimNameTail(match[1]));
    if (isValidPersonName(candidate, placeNormalized, "governador")) return candidate;
  }

  return null;
}

function extractMayorNameFromSnippet(placeNormalized: string, snippet: string): string | null {
  const rawSnippet = decodeHtmlEntities(snippet);
  const normalizedSnippet = normalize(rawSnippet);
  const mentionsMayor = /\bprefeit[oa]\b/.test(normalizedSnippet);
  const mentionsPlace = normalizedSnippet.includes(placeNormalized);
  if (!mentionsMayor || !mentionsPlace) return null;

  const escapedPlace = escapeRegExp(placeNormalized).replace(/\s+/g, "\\s+");
  const placePattern = escapedPlace;
  const patterns = [
    new RegExp(`prefeit[oa]\\s+(?:de|do|da)\\s+${placePattern}\\s*[,:-]\\s*([^,.;\\n]{3,90})`, "i"),
    new RegExp(`prefeit[oa]\\s+(?:de|do|da)\\s+${placePattern}\\s+(?:e|eh|é)\\s+([^,.;\\n]{3,90})`, "i"),
    new RegExp(`([^,.;\\n]{3,90})\\s+(?:e|eh|é)\\s+o\\s+prefeito\\s+(?:de|do|da)\\s+${placePattern}`, "i"),
    new RegExp(`([^,.;\\n]{3,90})\\s*,\\s*o\\s+prefeito\\s+(?:de|do|da)\\s+${placePattern}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = rawSnippet.match(pattern);
    if (!match?.[1]) continue;
    const candidate = cleanName(trimNameTail(match[1]));
    if (isValidPersonName(candidate, placeNormalized, "prefeito")) return candidate;
  }

  return null;
}

function extractPresidentNameFromSnippet(placeNormalized: string, snippet: string): string | null {
  const rawSnippet = decodeHtmlEntities(snippet);
  const normalizedSnippet = normalize(rawSnippet);
  const mentionsPresident = normalizedSnippet.includes("presidente");
  if (!mentionsPresident) return null;
  const hasDirectCurrentPattern = /presidente\s+atual\s+(?:e|eh|é)\s+/.test(rawSnippet.toLowerCase());

  const mentionsPlace =
    placeNormalized === "estados unidos"
      ? /\b(estados unidos|eua|usa)\b/.test(normalizedSnippet)
      : normalizedSnippet.includes(placeNormalized);
  if (!mentionsPlace && !hasDirectCurrentPattern) return null;

  const placePattern =
    placeNormalized === "estados unidos"
      ? "(?:estados\\s+unidos(?:\\s+da\\s+america)?|eua|usa)"
      : escapeRegExp(placeNormalized).replace(/\s+/g, "\\s+");
  const patterns = [
    new RegExp(`presidente\\s+atual\\s+(?:e|eh|é)\\s+([^,.;\\n]{3,90})`, "i"),
    new RegExp(`atual\\s+presidente\\s+da\\s+rep(?:u|ú)blica\\s+federativa\\s+(?:do|da|dos|das)\\s+${placePattern}\\s+(?:e|eh|é)\\s+([^,.;\\n]{3,90})`, "i"),
    new RegExp(`presidente\\s+da\\s+rep(?:u|ú)blica\\s+federativa\\s+(?:do|da|dos|das)\\s+${placePattern}\\s+(?:e|eh|é)\\s+([^,.;\\n]{3,90})`, "i"),
    new RegExp(`nome\\s+do\\s+presidente\\s+(?:do|da|dos|das)\\s+${placePattern}\\s+(?:e|eh|é)\\s+([^,.;\\n]{3,90})`, "i"),
    new RegExp(`presidente\\s+(?:do|da|dos|das)\\s+${placePattern}\\s+(?:e|eh|é)\\s+([^,.;\\n]{3,90})`, "i"),
    new RegExp(`presidente\\s+(?:do|da|dos|das)\\s+${placePattern}\\s*[,:-]?\\s*([^,.;\\n]{3,90})`, "i"),
    new RegExp(`o\\s+presidente\\s+([^,.;\\n]{3,90})`, "i"),
    new RegExp(`([^,.;\\n]{3,90})\\s+(?:e|eh|é)\\s+o\\s+presidente\\s+(?:do|da|dos|das)\\s+${placePattern}`, "i"),
    new RegExp(`([^,.;\\n]{3,90})\\s*,?\\s*o\\s+atual\\s+presidente\\s+(?:do|da|dos|das)\\s+${placePattern}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = rawSnippet.match(pattern);
    if (!match?.[1]) continue;
    const candidate = cleanName(trimNameTail(match[1]));
    if (isValidPersonName(candidate, placeNormalized, "presidente")) return candidate;
  }

  return null;
}

function extractPersonName(parsed: ParsedRoleQuestion, snippet: string): string | null {
  if (parsed.role === "governador") {
    return extractGovernorNameFromSnippet(parsed.placeNormalized, snippet);
  }
  if (parsed.role === "prefeito") {
    return extractMayorNameFromSnippet(parsed.placeNormalized, snippet);
  }
  return extractPresidentNameFromSnippet(parsed.placeNormalized, snippet);
}

export function buildFactualAnswerFallback(input: FactualAnswerFallbackInput): FactualAnswerFallbackResult | null {
  const parsed = parseRoleQuestion(input.question);
  if (!parsed) return null;

  const votes = new Map<string, number>();
  const citationByName = new Map<string, string[]>();

  for (const source of input.sources) {
    const primaryText = `${source.snippet || ""}`.trim();
    const fallbackText = `${source.title || ""}`.trim();
    const name = extractPersonName(parsed, primaryText) || extractPersonName(parsed, fallbackText);
    if (!name) continue;
    const weight = 1 + Math.max(0, Math.min(1, source.freshnessScore || 0)) * 0.4;
    votes.set(name, Number(((votes.get(name) || 0) + weight).toFixed(4)));
    citationByName.set(name, [...(citationByName.get(name) || []), source.url]);
  }

  const ranked = [...votes.entries()].sort((left, right) => right[1] - left[1]);
  if (!ranked.length) return null;

  const [personName, score] = ranked[0];
  const citations = [...new Set((citationByName.get(personName) || []).filter((url) => /^https?:\/\//i.test(url)))].slice(0, 3);
  const confidence = Math.max(0.45, Math.min(0.95, 0.35 + (score * 0.16) + (citations.length * 0.1)));

  const citationText = citations.length ? " Confirmado em fontes web recentes." : "";
  const answer =
    parsed.role === "governador"
      ? `O governador do ${parsed.placeDisplay} e ${personName}.${citationText}`
      : parsed.role === "prefeito"
        ? `O prefeito de ${parsed.placeDisplay} e ${personName}.${citationText}`
        : `O presidente de ${parsed.placeDisplay} e ${personName}.${citationText}`;

  return {
    answer,
    citations,
    confidence,
    role: parsed.role,
    place: parsed.placeDisplay,
    personName,
  };
}

