/**
 * Responsabilidade do arquivo:
 * - Centralizar heuristicas leves de sinais conversacionais e memoria de nome.
 * - Identificar prompts de chat curto sem conflitar com perguntas factuais/tecnicas.
 * - Extrair ultima fala util do usuario para reduzir contaminacao por artefatos internos.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { textNormalizationService } from "../text-processing/text-normalization.service";

function normalize(value: string): string {
  return textNormalizationService
    .expandContractions(value || "")
    .replace(/[^\p{L}\p{N}\s?!]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export type GreetingFamilyId =
  | "greeting_open"
  | "greeting_timebound"
  | "greeting_reentry"
  | "greeting_formal"
  | "greeting_courtesy_ping"
  | "greeting_checkin";

export interface GreetingFamilyDetection {
  detected: boolean;
  family: GreetingFamilyId | null;
  confidence: number;
  canonicalText: string;
}

const GREETING_VOCATIVE_SEGMENT =
  "(?:\\s+(?:leticia|ia|assistente|amiga|amigo|bot|pessoal|galera|time|gente|equipe))*";

const GREETING_TASK_SIGNAL =
  /\b(preciso|quero|ajuda|ajudar|ajuste|corrija|corrigir|crie|gere|pesquise|busque|explique|resuma|analise|compare|implemente|codigo|modulo|arquivo|pipeline|sql|api|prompt)\b/;

const GREETING_OPEN_PATTERNS: RegExp[] = [
  new RegExp(`^(?:oi+|oie+|ola+|opa+|fala+|salve+|alo+|alou+|hello+|hi+|hey+|yo+|e ai+|e ae+|eae+|saudacoes|saudacao)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:iae+|iaeh+|iae\\s+mano|iae\\s+pessoal|ola\\s+pessoal|ola\\s+time|oi\\s+pessoal|oi\\s+time|opa\\s+pessoal|ola\\s+gente|oi\\s+gente)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:bom\\s+te\\s+ver|que\\s+bom\\s+te\\s+ver|quanto\\s+tempo|fala\\s+ai|fala\\s+comigo)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:hello there|hi there|hey there)${GREETING_VOCATIVE_SEGMENT}$`),
];

const GREETING_TIMEBOUND_PATTERNS: RegExp[] = [
  new RegExp(`^(?:bom dia+|boa tarde+|boa noite+|boa madrugada+|boa manha+|boa tardee|boa trde)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:bomdia+|boatarde+|boanoite+|boamadrugada+|boamanha+)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:otimo dia+|excelente dia+|tenha um bom dia+|tenha uma boa tarde+|tenha uma boa noite+)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:bom inicio de dia|bom comeco de dia|otima tarde|excelente noite)${GREETING_VOCATIVE_SEGMENT}$`),
];

const GREETING_REENTRY_PATTERNS: RegExp[] = [
  new RegExp(`^(?:voltei+|to de volta|estou de volta|retornei+|cheguei de volta|apareci de novo|de volta)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:voltei aqui|to aqui de novo|estou aqui de novo|retornando|retornei agora|apareci novamente|de novo eu)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:oi+|ola+|opa+)\\s+(?:de novo|novamente|voltei+)${GREETING_VOCATIVE_SEGMENT}$`),
];

const GREETING_FORMAL_PATTERNS: RegExp[] = [
  new RegExp(`^(?:cordiais saudacoes|meus cumprimentos|cumprimentos|saudacoes cordiais|prezado(?:s)?(?: bom dia| boa tarde| boa noite)?)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:respeitosas saudacoes|saudacoes respeitosas|atenciosos cumprimentos|cordialmente|prezado(?:s)?|caro(?:s)? colega(?:s)?)${GREETING_VOCATIVE_SEGMENT}$`),
];

const GREETING_COURTESY_PING_PATTERNS: RegExp[] = [
  new RegExp(`^(?:tem alguem ai|alguem ai|alguem por ai|esta ai|ta ai|alo tem alguem ai|esta me ouvindo|ta me ouvindo|consegue me ouvir)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:tem alguem online|alguem disponivel|tem alguem por aqui|esta online|ta online|voce esta ai|vc ta ai|ta por ai)${GREETING_VOCATIVE_SEGMENT}$`),
];

const GREETING_CHECKIN_PATTERNS: RegExp[] = [
  new RegExp(`^(?:oi+|ola+|opa+|saudacoes|bom dia|boa tarde|boa noite)\\s+(?:tudo bem|tudo certo|tudo tranquilo|como vai|como esta|como voce esta|que tal)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:tudo bem(?: com (?:vc|voce|ce))?|td bem|tudo certo|tudo tranquilo|como vai|como esta|como voce esta|que tal)${GREETING_VOCATIVE_SEGMENT}$`),
  new RegExp(`^(?:como c ta|como ce ta|como vc ta|blz|beleza|de boa|suave|tranquilo ai|tranquilo por ai)${GREETING_VOCATIVE_SEGMENT}$`),
];

function compactGreetingText(value: string): string {
  return `${value || ""}`
    .replace(/[?!]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyGreetingByPatterns(compact: string): GreetingFamilyId | null {
  if (!compact) return null;

  const tokenCount = compact.split(" ").filter(Boolean).length;
  if (tokenCount > 3 && GREETING_TASK_SIGNAL.test(compact)) return null;

  if (matchesAnyPattern(compact, GREETING_REENTRY_PATTERNS)) return "greeting_reentry";
  if (matchesAnyPattern(compact, GREETING_TIMEBOUND_PATTERNS)) return "greeting_timebound";
  if (matchesAnyPattern(compact, GREETING_FORMAL_PATTERNS)) return "greeting_formal";
  if (matchesAnyPattern(compact, GREETING_COURTESY_PING_PATTERNS)) return "greeting_courtesy_ping";
  if (matchesAnyPattern(compact, GREETING_CHECKIN_PATTERNS)) return "greeting_checkin";
  if (matchesAnyPattern(compact, GREETING_OPEN_PATTERNS)) return "greeting_open";

  return null;
}

function confidenceByGreetingFamily(family: GreetingFamilyId | null): number {
  if (!family) return 0;
  if (family === "greeting_checkin") return 0.88;
  if (family === "greeting_courtesy_ping") return 0.86;
  if (family === "greeting_reentry") return 0.92;
  if (family === "greeting_formal") return 0.93;
  if (family === "greeting_timebound") return 0.95;
  return 0.94;
}

export function classifyGreetingFamily(text: string): GreetingFamilyId | null {
  const compact = compactGreetingText(normalize(text));
  return classifyGreetingByPatterns(compact);
}

export function resolveGreetingFamily(text: string): GreetingFamilyDetection {
  const compact = compactGreetingText(normalize(text));
  const family = classifyGreetingByPatterns(compact);
  return {
    detected: family != null,
    family,
    confidence: confidenceByGreetingFamily(family),
    canonicalText: compact,
  };
}

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
  /\b(lembra meu nome|como eu me chamo|qual nome voce tem salvo pra mim|qual nome voce tem salvo para mim|qual nome vc tem salvo pra mim|qual nome vc tem salvo para mim)\b/i,
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
  /\b((por que|porque|pq)\s+(?:voce|vc|ce)\s+se\s+chama\s+assim|se\s+chama\s+assim)\b/i,
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
  /\b(foi ele que te criou|ele te criou|voce e (?:filha|filho) dele|vc e (?:filha|filho) dele)\b/i,
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

  const hasTranscriptRoleMarkers = lines.some((line) =>
    /^(?:usuario|usuário|user|assistant|assistente|leticia|sistema|system|human|model)\s*:/i.test(line),
  );
  const structuredEnumeratedLines = lines.filter((line) =>
    /^\(?\s*(?:[a-z]|\d+)\s*\)/i.test(line) || /^\s*(?:\d+[\).]|[-*•])\s+/.test(line),
  ).length;
  const imperativeStructuredLines = lines.filter((line) =>
    /\b(demonstre|explique|mostre|proponha|reformule|explicite|compare|analise|construa|fa[cç]a o seguinte|show|explain|compare|propose|reformulate|state explicitly)\b/i.test(
      normalize(line),
    ),
  ).length;
  const longInformativeLines = lines.filter((line) => line.length >= 40).length;
  const hasStructuredParagraphBreaks = source.includes("\n\n");
  const isStructuredSingleTurnPrompt =
    !hasTranscriptRoleMarkers &&
    (
      structuredEnumeratedLines >= 2 ||
      imperativeStructuredLines >= 2 ||
      (hasStructuredParagraphBreaks && longInformativeLines >= 2)
    );

  if (isStructuredSingleTurnPrompt) {
    return source;
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
  return resolveGreetingFamily(text).detected;
}

export function isSmallTalkMessage(text: string): boolean {
  const normalized = normalize(text);
  const greetingFamily = classifyGreetingByPatterns(compactGreetingText(normalized));
  return greetingFamily === "greeting_checkin" || greetingFamily != null || matchesAnyPattern(normalized, SMALL_TALK_PATTERNS);
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

