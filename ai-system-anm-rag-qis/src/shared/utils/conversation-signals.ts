/**
 * Responsabilidade do arquivo:
 * - Centralizar heuristicas leves de sinais conversacionais e memoria de nome.
 * - Identificar prompts de chat curto sem conflitar com perguntas factuais/tecnicas.
 * - Extrair ultima fala util do usuario para reduzir contaminacao por artefatos internos.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

function normalize(value: string): string {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s?!]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeConversationText(value: string): string {
  return normalize(value);
}

const INTERNAL_ARTIFACT_PATTERNS = [
  /\bpensou por \d+(?:ms|s)\b/i,
  /\bleitura (?:factual|contextual|hipotetica)[-\w]*\b/i,
  /\bevidencia[-\s]?guia\b/i,
  /\bsequencia de tarefas\b/i,
  /\braciocinio multihipotese\b/i,
  /\bq-branch-\d+\b/i,
  /\bsuporte abdutivo\b/i,
  /\bstatus hypothesis\b/i,
  /\bstatus epistemico\b/i,
];

export function isInternalReasoningArtifact(text: string): boolean {
  const compact = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return false;
  return INTERNAL_ARTIFACT_PATTERNS.some((pattern) => pattern.test(compact));
}

export function extractLatestUserUtterance(text: string): string {
  const source = `${text || ""}`.replace(/\r/g, "").trim();
  if (!source) return "";

  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return lines[0] || source;
  }

  const withoutThinkingMarkers = lines.filter((line) => !/^\s*pensou por \d+\s*(?:ms|s)\s*$/i.test(line));
  const nonArtifactQuestions = withoutThinkingMarkers.filter(
    (line) => line.includes("?") && !isInternalReasoningArtifact(line),
  );
  if (nonArtifactQuestions.length > 0) {
    return nonArtifactQuestions[nonArtifactQuestions.length - 1];
  }

  const nonArtifactLines = withoutThinkingMarkers.filter((line) => !isInternalReasoningArtifact(line));
  if (nonArtifactLines.length > 0) {
    return nonArtifactLines[nonArtifactLines.length - 1];
  }

  return withoutThinkingMarkers[withoutThinkingMarkers.length - 1] || source;
}

export function toDisplayName(value: string): string {
  const cleaned = `${value || ""}`
    .trim()
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s{2,}/g, " ");
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/g)
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function isGreetingMessage(text: string): boolean {
  const normalized = normalize(text);
  return /^(oi+|ola+|ol|\w*hello\w*|hi|hey|e ai|eae)\??$/.test(normalized);
}

export function isSmallTalkMessage(text: string): boolean {
  const normalized = normalize(text);
  return (
    isGreetingMessage(normalized) ||
    /^(tudo bem\??|como vc esta\??|como voce esta\??|como vai\??|beleza\??)$/.test(normalized)
  );
}

export function isNameSharePrompt(text: string): boolean {
  const normalized = normalize(text);
  return /\b(posso te dizer meu nome|pode te dizer meu nome|posso falar meu nome|quer saber meu nome)\b/i.test(normalized);
}

export function isNameRecallPrompt(text: string): boolean {
  const normalized = normalize(text);
  return /\b(qual(?:\s+(?:e|eh))?\s+o?\s*meu nome|qual meu nome|como voce me chama|como vc me chama|diga meu nome)\b/i.test(normalized);
}

export function extractPreferredNameFromText(text: string): string | null {
  const cleaned = `${text || ""}`.trim();
  if (!cleaned) return null;
  const patterns = [
    /(?:meu nome (?:e|eh)|my name is)\s+([A-Za-z][A-Za-z' -]{1,48})/i,
    /(?:pode (?:passar a )?me chamar de|me chame de|chame-me de|call me)\s+([A-Za-z][A-Za-z' -]{1,48})/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (!match?.[1]) continue;
    const candidate = match[1]
      .replace(/\b(de agora em diante|a partir de agora)\b/gi, "")
      .trim();
    const display = toDisplayName(candidate);
    if (display) return display;
  }

  return null;
}

export function extractPreferredNameFromTurns(
  turns: Array<{ role: "user" | "assistant"; content: string }>,
): string | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const content = turns[index]?.content || "";
    const explicit = extractPreferredNameFromText(content);
    if (explicit) return explicit;

    const assistantAck = content.match(/(?:perfeito|certo|ok),\s*([A-Za-z][A-Za-z' -]{1,48})/i)?.[1];
    if (assistantAck) {
      const display = toDisplayName(assistantAck);
      if (display) return display;
    }
  }
  return null;
}

export function extractPreferredNameFromIdentityMemory(state: ProcessingState): string | null {
  const fromProfile = typeof state.userProfile.preferredName === "string"
    ? toDisplayName(state.userProfile.preferredName)
    : "";
  if (fromProfile) return fromProfile;

  const identityHits = state.memorySnapshot.globalNamespaces.identity || [];
  for (const item of identityHits) {
    const match = item.match(/(?:preferred_name|nome_preferido|address_user_as)\s*[:=]\s*(.+)$/i);
    if (!match?.[1]) continue;
    const display = toDisplayName(match[1]);
    if (display) return display;
  }
  return null;
}

export function isConversationalPrompt(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;

  if (
    isSmallTalkMessage(normalized) ||
    isNameSharePrompt(normalized) ||
    isNameRecallPrompt(normalized) ||
    extractPreferredNameFromText(normalized)
  ) {
    return true;
  }

  const hasQuestion = normalized.includes("?");
  const tokens = normalized.split(" ").filter(Boolean);
  const hasTechnicalSignal = /\b(api|endpoint|typescript|javascript|python|sql|docker|kubernetes|bug|debug)\b/i.test(normalized);
  const hasFactualSignal = /\b(presidente|governador|prefeito|ceo|capital|cotacao|price|fonte|source|latest|today|atual)\b/i.test(normalized);
  const hasResearchSignal = /\b(pesquisa|pesquise|buscar|busca|busque|procure|artigo|paper|estudo|literatura|referencia|referencias|doi|scholar|scielo|pubmed)\b/i.test(normalized);

  if (!hasTechnicalSignal && !hasFactualSignal && !hasResearchSignal && hasQuestion && tokens.length <= 10) return true;
  return false;
}

