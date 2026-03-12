import type { ConversationPerceptionState } from "./types";

export type ResponseStructureOptions = {
  state: ConversationPerceptionState;
  complexity: "micro" | "direct" | "short" | "medium" | "complex";
};

function normalizeWhitespace(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const META_LEAK_PATTERNS = [
  /\bpensamento estendido\b/i,
  /\bchain of thought\b/i,
  /\banalysis\b/i,
  /\breflection\b/i,
  /\brazonamiento interno\b/i,
  /\bescreva as orientacoes para o arquivo\b/i,
  /\bescrever as orientacoes para o arquivo\b/i,
  /\bescreva as orientacoes\b/i,
  /\bnao possuo estado fisico ou emocional\b/i,
  /\bsou apenas um software\b/i,
  /\bem termos de performance e funcionalidade\b/i,
  /\binstrucoes internas\b/i,
  /\binternal instructions\b/i,
];

function foldForGuard(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function foldLoose(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingAnswerLabel(text: string) {
  let current = `${text || ""}`.trim();
  const pattern = /^\(?\s*(?:resposta|response|answer)(?:\s+em\s+(?:portugues|portugu[eê]s|english|ingles|espanol|español)(?:\s+brasileiro)?)?\s*[:\-]\s*/i;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!pattern.test(current)) break;
    current = current.replace(pattern, "").trim();
  }
  return current;
}

function stripTrailingAnswerWrapper(text: string) {
  let current = `${text || ""}`.trim();
  const pattern =
    /[\(\[]\s*(?:resposta|response|answer)(?:\s+em\s+(?:portugues|portugu[eê]s|english|ingles|espanol|español)(?:\s+brasileiro)?)?\s*[:\-]\s*([\s\S]*?)\s*[\)\]]\s*$/i;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const match = current.match(pattern);
    if (!match || match.index === undefined) break;
    const prefix = current.slice(0, match.index).trim();
    const inner = `${match[1] || ""}`.trim();
    if (!inner) {
      current = prefix;
      continue;
    }
    if (!prefix) {
      current = inner;
      continue;
    }
    const foldedPrefix = foldLoose(prefix);
    const foldedInner = foldLoose(inner);
    if (
      foldedPrefix &&
      foldedInner &&
      (foldedPrefix === foldedInner || foldedPrefix.endsWith(foldedInner) || foldedInner.endsWith(foldedPrefix))
    ) {
      current = prefix;
      continue;
    }
    // Wrapper detected but content diverges; keep the primary answer and drop the wrapper.
    current = prefix;
  }
  return current.trim();
}

function stripAnswerArtifacts(text: string) {
  let current = stripLeadingAnswerLabel(text);
  current = stripTrailingAnswerWrapper(current);
  current = current.replace(/[\(\[]\s*(?:resposta|response|answer)\s*[\)\]]\s*$/i, "").trim();
  return current;
}

function stripMetaLeakage(text: string) {
  const keptLines: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === "+" || line === "-" || line === "..." || line === "```") continue;
    const folded = foldForGuard(line);
    if (META_LEAK_PATTERNS.some((pattern) => pattern.test(folded))) continue;
    keptLines.push(rawLine);
  }
  return keptLines.join("\n").trim();
}

function looksLikeListLine(line: string) {
  return /^([-*]|\d+\.)\s+/.test(line);
}

function shouldKeepListFormat(state: ConversationPerceptionState) {
  const style = `${state.required_style || ""}`.toLowerCase();
  return /\blista|topicos|t[oó]picos|bullet|json\b/.test(style);
}

function collapseMicroBlocksIntoParagraph(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return text.trim();
  if (lines.some((line) => looksLikeListLine(line))) return text.trim();

  const merged: string[] = [];
  for (const line of lines) {
    const last = merged[merged.length - 1] || "";
    if (!last) {
      merged.push(line);
      continue;
    }
    const shouldJoin = !/[.!?:;]$/.test(last) || /^[a-z0-9]/i.test(line);
    if (shouldJoin) {
      merged[merged.length - 1] = `${last} ${line}`.replace(/\s+/g, " ").trim();
      continue;
    }
    merged.push(line);
  }
  return merged.join("\n\n");
}

function enforceParagraphDensity(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!paragraphs.length) return "";

  const denseParagraphs: string[] = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    if (!buffer) {
      buffer = paragraph;
      continue;
    }
    const hasTransition = /^(por outro lado|alem disso|al[eé]m disso|em seguida|por fim|agora|no entanto)\b/i.test(paragraph);
    const bufferShort = buffer.length < 180 || (buffer.match(/[.!?]/g) || []).length < 2;
    if (bufferShort && !hasTransition) {
      buffer = `${buffer} ${paragraph}`.replace(/\s+/g, " ").trim();
      continue;
    }
    denseParagraphs.push(buffer);
    buffer = paragraph;
  }
  if (buffer) denseParagraphs.push(buffer);
  return denseParagraphs.join("\n\n");
}

function removeExcessiveLineBreaks(text: string) {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function trimDanglingTail(text: string) {
  const normalized = text.trim();
  if (!normalized) return "";
  if (/[.!?]"?$/.test(normalized)) return normalized;

  const lastTerminal = Math.max(normalized.lastIndexOf("."), normalized.lastIndexOf("!"), normalized.lastIndexOf("?"));
  if (lastTerminal >= 0 && lastTerminal >= Math.floor(normalized.length * 0.45)) {
    return normalized.slice(0, lastTerminal + 1).trim();
  }

  if (/[,;:]\s*$/.test(normalized)) return normalized.replace(/[,;:]\s*$/, ".").trim();
  return normalized;
}

export function enforceResponseStructure(rawText: string, options: ResponseStructureOptions) {
  const normalized = stripAnswerArtifacts(stripMetaLeakage(normalizeWhitespace(rawText)));
  if (!normalized) return "";

  if (options.complexity === "micro") {
    return trimDanglingTail(normalized.split("\n")[0].trim());
  }

  if (shouldKeepListFormat(options.state)) {
    return removeExcessiveLineBreaks(normalized);
  }

  const noMicroBlocks = collapseMicroBlocksIntoParagraph(normalized);
  if (options.complexity === "direct" || options.complexity === "short") {
    return trimDanglingTail(removeExcessiveLineBreaks(noMicroBlocks));
  }

  const dense = enforceParagraphDensity(noMicroBlocks);
  return trimDanglingTail(removeExcessiveLineBreaks(dense || noMicroBlocks));
}


