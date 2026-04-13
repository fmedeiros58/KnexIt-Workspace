import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface ConversationTimelineInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ConversationTimelineOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function normalizeForTimeline(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function repairCommonMojibake(value: string): string {
  return `${value || ""}`
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0081/g, "Á")
    .replace(/Ã\u0089/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã\u0093/g, "Ó")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã\u0087/g, "Ç")
    .replace(/intelig[\uFFFD]ncia/gi, "inteligencia")
    .replace(/informa[\uFFFD]{1,2}es/gi, "informacoes")
    .replace(/fa[\uFFFD]a/gi, "faca")
    .replace(/d[\uFFFD]vida/gi, "duvida")
    .replace(/o que [\uFFFD]/gi, "o que e")
    .replace(/let[\uFFFD]cia/gi, "Leticia")
    .replace(/usu[\uFFFD]rio/gi, "Usuario")
    .replace(/\uFFFD+/g, "");
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function sanitizeTimelineText(value: string): string {
  return collapseWhitespace(repairCommonMojibake(value));
}

function splitSegments(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function conversationTimeline(input: ConversationTimelineInput = {}): ConversationTimelineOutput {
  const sanitizedText = sanitizeTimelineText(input.text || "");
  const analysis = analyzeSignalText(sanitizedText);
  const normalized = normalizeForTimeline(analysis.text);

  const temporalMarkers = countSignalMatches(
    normalized,
    /\b(primeiro|depois|entao|agora|antes|apos|em seguida|na sequencia|first|then|now|before|after|next)\b/g,
  );

  const turnMarkers =
    countSignalMatches(
      normalized,
      /\b(user|usuario|assistente|assistant|leticia)\s*:/g,
    ) +
    countSignalMatches(
      normalized,
      /\b(user|usuario|assistente|assistant|leticia)\s*-\s*/g,
    );

  const roleTransitions = countSignalMatches(
    normalized,
    /\b(usuario|user|assistente|assistant|leticia)\s*:/g,
  );

  const segments = splitSegments(analysis.text);

  const transcriptLikeStructure = turnMarkers >= 2;
  const temporalProgressionSignal = temporalMarkers > 0;
  const segmentDensitySignal = segments.length > 1;
  const inferredTurnCount = Math.max(turnMarkers, roleTransitions, segments.length > 0 ? Math.min(segments.length, 12) : 0);

  const inferredScore = clamp01(
    0.18 +
    (Math.min(1, temporalMarkers / 3) * 0.28) +
    (Math.min(1, turnMarkers / 4) * 0.28) +
    (Math.min(1, segments.length / 6) * 0.16) +
    (transcriptLikeStructure ? 0.1 : 0),
  );

  const finalScore =
    typeof input.score === "number" && Number.isFinite(input.score)
      ? clamp01(input.score)
      : inferredScore;

  return {
    ok: true,
    component: "conversation-timeline",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `segments=${segments.length}; temporalMarkers=${temporalMarkers}; turnMarkers=${turnMarkers}; transcriptLike=${transcriptLikeStructure}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      segmentCount: segments.length,
      temporalMarkers,
      turnMarkers,
      roleTransitions,
      inferredTurnCount,
      temporalProgressionSignal,
      transcriptLikeStructure,
      hasTimelineSignal: temporalProgressionSignal || segmentDensitySignal || transcriptLikeStructure,
      hasText: Boolean(analysis.text),
      tokenCount: analysis.tokenCount,
    },
  };
}