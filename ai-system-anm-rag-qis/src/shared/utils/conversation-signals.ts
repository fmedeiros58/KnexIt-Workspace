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

function matchesAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

const GREETING_PATTERNS: RegExp[] = [
  /^(oi+|ola+|oie+|oii+|opa|fala|salve|saudacoes|e ai|eae|hey|hello|hi|yo)(?: leticia)?\??$/,
  /^(bom dia|boa tarde|boa noite)(?: leticia)?\??$/,
  /^(boa trde|boa tardee|boa tardee)(?: leticia)?\??$/,
];

const SMALL_TALK_PATTERNS: RegExp[] = [
  /^(tudo bem(?: com (?:vc|voce|ce))?|td bem|tudo certo|tudo tranquilo)(?: leticia)?\??$/,
  /^(como (?:vc|voce|ce) (?:esta|ta)|como vai|que tal)(?: leticia)?\??$/,
  /^(beleza|blz|de boa|tranquilo|suave)(?: leticia)?\??$/,
  /^(?:oi+|ola+|opa|fala|salve|saudacoes)\s+(?:tudo bem(?: com (?:vc|voce|ce))?|como vai|que tal)(?: leticia)?\??$/,
];

const NAME_SHARE_PATTERNS: RegExp[] = [
  /\b(posso (?:te )?(?:dizer|falar) meu nome|quer saber meu nome)\b/i,
  /\b(pode (?:te )?(?:dizer|falar) meu nome)\b/i,
  /\b(vou te dizer meu nome|te digo meu nome|deixa eu te dizer meu nome)\b/i,
];

const NAME_RECALL_PATTERNS: RegExp[] = [
  /\b(qual(?:\s+(?:e|eh))?\s+o?\s*meu nome|qual meu nome|como voce me chama|como vc me chama)\b/i,
  /\b(diga meu nome|lembra (?:do|de) meu nome|voce lembra (?:do|de) meu nome|vc lembra (?:do|de) meu nome)\b/i,
  /\b(lembra meu nome|como eu me chamo|qual nome voce tem salvo pra mim)\b/i,
];

const ASSISTANT_IDENTITY_PATTERNS: RegExp[] = [
  /\b(qual(?:\s+(?:e|eh))?\s+(?:o\s+)?(?:seu|teu)\s+nome|qual(?:\s+(?:e|eh))?\s+nome\s+da\s+ia)\b/i,
  /\b(me diga (?:o\s+)?seu nome|me diz (?:o\s+)?seu nome|diga (?:o\s+)?seu nome)\b/i,
  /\b(como (?:voce|vc|ce) se chama|quem (?:e|eh) (?:voce|vc|ce)|voce (?:e|eh) a leticia|vc (?:e|eh) a leticia)\b/i,
  /\b(como posso te chamar|posso te chamar de leticia|e o seu)\b/i,
];

const ASSISTANT_NAME_ORIGIN_PATTERNS: RegExp[] = [
  /\b((por que|porque|pq)\s+(?:voce|vc|ce)\s+(?:tem|usa)\s+(esse\s+)?nome)\b/i,
  /\b((por que|porque|pq)\s+(?:voce|vc|ce)\s+se\s+chama\s+leticia)\b/i,
  /\b((por que|porque|pq)\s+te\s+chamam\s+assim|te\s+chamam\s+assim)\b/i,
  /\b(qual(?:\s+(?:e|eh))?\s+a\s+origem\s+do\s+seu\s+nome|de onde vem o nome leticia|de onde veio seu nome)\b/i,
  /\b(o que significa leticia|qual o significado(?: do nome)?(?: de)? leticia|leticia significa o que|o que quer dizer leticia)\b/i,
  /\b(qual(?:\s+(?:e|eh))?\s+o\s+conceito\s+(?:de|da)\s+leticia|conceito\s+de\s+leticia)\b/i,
  /\b(qual(?:\s+(?:e|eh))?\s+a\s+definicao\s+(?:de|da)\s+leticia|definicao\s+de\s+leticia)\b/i,
  /\b(base\s+conceitual\s+do\s+nome\s+leticia|de\s+onde\s+surgiu\s+(?:o\s+nome\s+)?leticia|de\s+onde\s+surgiu\s+esse\s+nome)\b/i,
  /\b(como\s+surgiu\s+(?:o\s+nome\s+)?leticia|qual\s+a\s+historia\s+do\s+nome\s+leticia)\b/i,
  /\b(qual(?:\s+(?:e|eh))?\s+a\s+ideia\s+por\s+tras\s+do\s+nome\s+leticia|conceito\s+por\s+tras\s+do\s+nome\s+leticia)\b/i,
  /\b(defina\s+leticia|como\s+se\s+define\s+leticia|qual\s+a\s+definicao\s+do\s+nome\s+leticia)\b/i,
];

const ASSISTANT_CREATOR_PATTERNS: RegExp[] = [
  /\b(quem (?:e|eh) (?:o\s+)?medeiros|quem e esse medeiros)\b/i,
  /\b(quem te criou|quem criou voce|quem e seu criador|quem desenvolveu voce)\b/i,
  /\b(quem idealizou (?:voce|o projeto)|quem te batizou)\b/i,
];

function hasReferentialFactualCue(normalized: string): boolean {
  const hasReferentialSubject = /\b(ele|ela|dele|dela|esse|essa|isso|aquele|aquela)\b/i.test(normalized);
  const hasOfficeCue = /\b(presidente|governador|prefeito|ceo|ministro|senador|deputado)\b/i.test(normalized);
  const hasTemporalFactCue =
    /\b(quando|when|em que ano|que ano|ano|mandato|eleit[oa]|reeleit[oa]|posse|tomou posse|foi eleito|foi eleita|elected|mandate)\b/i.test(
      normalized,
    );
  return (hasReferentialSubject && hasTemporalFactCue) || (hasOfficeCue && hasTemporalFactCue);
}

export function normalizeConversationText(value: string): string {
  return normalize(value);
}

export function isReferentialFactualPrompt(text: string): boolean {
  return hasReferentialFactualCue(normalize(text));
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
  return matchesAnyPattern(normalized, GREETING_PATTERNS);
}

export function isSmallTalkMessage(text: string): boolean {
  const normalized = normalize(text);
  return isGreetingMessage(normalized) || matchesAnyPattern(normalized, SMALL_TALK_PATTERNS);
}

export function isNameSharePrompt(text: string): boolean {
  const normalized = normalize(text);
  return matchesAnyPattern(normalized, NAME_SHARE_PATTERNS);
}

export function isNameRecallPrompt(text: string): boolean {
  const normalized = normalize(text);
  return matchesAnyPattern(normalized, NAME_RECALL_PATTERNS);
}

export function isAssistantIdentityPrompt(text: string): boolean {
  const normalized = normalize(text);
  return matchesAnyPattern(normalized, ASSISTANT_IDENTITY_PATTERNS);
}

export function isAssistantNameOriginPrompt(text: string): boolean {
  const normalized = normalize(text);
  return matchesAnyPattern(normalized, ASSISTANT_NAME_ORIGIN_PATTERNS);
}

export function isAssistantCreatorPrompt(text: string): boolean {
  const normalized = normalize(text);
  return matchesAnyPattern(normalized, ASSISTANT_CREATOR_PATTERNS);
}

export function extractPreferredNameFromText(text: string): string | null {
  const cleaned = `${text || ""}`.trim();
  if (!cleaned) return null;
  const patterns = [
    /(?:meu nome (?:e|eh)|my name is)\s+([\p{L}][\p{L}' -]{1,48})/iu,
    /(?:pode (?:passar a )?me chamar de|me chame de|chame-me de|call me)\s+([\p{L}][\p{L}' -]{1,48})/iu,
    /(?:^|[.!?]\s*)(?:eu\s+)?sou\s+([\p{L}]{2,}(?:\s+[\p{L}]{2,}){0,2})\b/iu,
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
  const tokens = normalized.split(" ").filter(Boolean);

  if (
    isSmallTalkMessage(normalized) ||
    isNameSharePrompt(normalized) ||
    isNameRecallPrompt(normalized) ||
    isAssistantIdentityPrompt(normalized) ||
    isAssistantNameOriginPrompt(normalized) ||
    isAssistantCreatorPrompt(normalized) ||
    extractPreferredNameFromText(normalized)
  ) {
    return true;
  }

  const hasQuestion = normalized.includes("?");
  const hasTechnicalSignal =
    /\b(api|endpoint|typescript|javascript|python|sql|docker|kubernetes|bug|debug|normalizer|normalizers|normalize|regex|parser)\b/i.test(
      normalized,
    );
  const hasFactualSignal =
    /\b(presidente|governador|prefeito|ceo|capital|cotacao|price|fonte|source|latest|today|atual|quando|where|when|ano|eleit[oa]|mandato|posse)\b/i.test(
      normalized,
    );
  const hasResearchSignal = /\b(pesquisa|pesquise|buscar|busca|busque|procure|artigo|paper|estudo|literatura|referencia|referencias|doi|scholar|scielo|pubmed)\b/i.test(normalized);
  const hasReferentialFactualSignal = hasReferentialFactualCue(normalized);

  const hasLooseGreetingSignal =
    tokens.length <= 3 &&
    (/^(boa|bom)\b/.test(normalized) || /^oi+\b|^ola+\b|^opa\b|^fala\b|^salve\b|^saudac/.test(normalized)) &&
    !hasTechnicalSignal &&
    !hasFactualSignal &&
    !hasResearchSignal &&
    !hasReferentialFactualSignal;
  if (hasLooseGreetingSignal) return true;

  if (
    !hasTechnicalSignal &&
    !hasFactualSignal &&
    !hasResearchSignal &&
    !hasReferentialFactualSignal &&
    hasQuestion &&
    tokens.length <= 10
  ) {
    return true;
  }
  return false;
}

