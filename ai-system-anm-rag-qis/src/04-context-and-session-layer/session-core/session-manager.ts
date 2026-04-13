import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface SessionManagerInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface SessionManagerOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
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

function sanitizeSessionText(value: string): string {
  return collapseWhitespace(repairCommonMojibake(value));
}

export function sessionManager(input: SessionManagerInput = {}): SessionManagerOutput {
  const sanitizedText = sanitizeSessionText(input.text || "");
  const analysis = analyzeSignalText(sanitizedText);
  const normalized = analysis.normalized || "";

  const userTurns =
    countSignalMatches(normalized, /\b(?:user|usuario|usuário)\s*:/g) +
    countSignalMatches(normalized, /\b(?:user|usuario|usuário)\s*-\s*/g);

  const assistantTurns =
    countSignalMatches(normalized, /\b(?:assistant|assistente|leticia|letícia)\s*:/g) +
    countSignalMatches(normalized, /\b(?:assistant|assistente|leticia|letícia)\s*-\s*/g);

  const continuityCues = countSignalMatches(
    normalized,
    /\b(?:continuar|continue|continuando|como antes|mesmo tema|same topic|as before|seguir|prosseguir|dar sequencia|dar continuidade)\b/g,
  );

  const resetCues = countSignalMatches(
    normalized,
    /\b(?:novo assunto|mudar tema|mude de assunto|reset|start over|from scratch|do zero|zerar contexto|outro assunto)\b/g,
  );

  const transcriptLikeLabels = userTurns + assistantTurns;
  const hasBidirectionalDialogue = userTurns > 0 && assistantTurns > 0;
  const hasTranscriptLikeStructure = transcriptLikeLabels >= 2;
  const turnSignal = Math.min(1, transcriptLikeLabels / 6);

  const stabilitySignal = clamp01(
    0.6 +
      (continuityCues * 0.12) -
      (resetCues * 0.15),
  );

  const inferredScore = clamp01(
    0.18 +
      (turnSignal * 0.34) +
      (stabilitySignal * 0.24) +
      (analysis.uniqueRatio * 0.08) +
      (hasBidirectionalDialogue ? 0.08 : 0) +
      (hasTranscriptLikeStructure ? 0.08 : 0),
  );

  const finalScore =
    typeof input.score === "number" && Number.isFinite(input.score)
      ? clamp01(input.score)
      : inferredScore;

  return {
    ok: true,
    component: "session-manager",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `userTurns=${userTurns}; assistantTurns=${assistantTurns}; stability=${stabilitySignal.toFixed(2)}; transcriptLike=${hasTranscriptLikeStructure}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      userTurns,
      assistantTurns,
      continuityCues,
      resetCues,
      transcriptLikeLabels,
      hasBidirectionalDialogue,
      hasTranscriptLikeStructure,
      stabilitySignal: Number(stabilitySignal.toFixed(4)),
      hasText: Boolean(analysis.text),
      tokenCount: analysis.tokenCount,
    },
  };
}