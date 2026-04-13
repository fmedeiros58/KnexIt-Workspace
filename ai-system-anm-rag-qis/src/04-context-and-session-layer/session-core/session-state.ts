import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface SessionStateInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface SessionStateOutput {
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

function sanitizeSessionStateText(value: string): string {
  return collapseWhitespace(repairCommonMojibake(value));
}

function classifySessionState(
  continueHits: number,
  resetHits: number,
  questionHits: number,
  transcriptLikeStructure: boolean,
): "resetting" | "continuing" | "inquiry" | "fresh" | "threaded" {
  if (resetHits > continueHits) return "resetting";
  if (continueHits > 0) return "continuing";
  if (transcriptLikeStructure) return "threaded";
  if (questionHits > 0) return "inquiry";
  return "fresh";
}

export function sessionState(input: SessionStateInput = {}): SessionStateOutput {
  const sanitizedText = sanitizeSessionStateText(input.text || "");
  const analysis = analyzeSignalText(sanitizedText);
  const normalized = analysis.normalized || "";

  const continueHits = countSignalMatches(
    normalized,
    /\b(continuar|continue|continuando|como antes|same thread|seguindo|retomar|dar continuidade|prosseguir|mesmo tema)\b/g,
  );

  const resetHits = countSignalMatches(
    normalized,
    /\b(reiniciar|reset|novo assunto|mudar assunto|mudar tema|start over|from scratch|zerar|do zero|outro assunto)\b/g,
  );

  const userLabels =
    countSignalMatches(normalized, /\b(?:user|usuario|usuário)\s*:/g) +
    countSignalMatches(normalized, /\b(?:user|usuario|usuário)\s*-\s*/g);

  const assistantLabels =
    countSignalMatches(normalized, /\b(?:assistant|assistente|leticia|letícia)\s*:/g) +
    countSignalMatches(normalized, /\b(?:assistant|assistente|leticia|letícia)\s*-\s*/g);

  const transcriptLikeStructure = userLabels + assistantLabels >= 2;
  const bidirectionalDialogue = userLabels > 0 && assistantLabels > 0;

  const stateName = classifySessionState(
    continueHits,
    resetHits,
    analysis.questionCount,
    transcriptLikeStructure,
  );

  const inferredScore = clamp01(
    0.18 +
      (Math.min(1, (continueHits + resetHits) / 3) * 0.28) +
      (Math.min(1, analysis.questionCount / 2) * 0.18) +
      (analysis.uniqueRatio * 0.1) +
      (transcriptLikeStructure ? 0.12 : 0) +
      (bidirectionalDialogue ? 0.08 : 0),
  );

  const finalScore =
    typeof input.score === "number" && Number.isFinite(input.score)
      ? clamp01(input.score)
      : inferredScore;

  return {
    ok: true,
    component: "session-state",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `state=${stateName}; continueHits=${continueHits}; resetHits=${resetHits}; transcriptLike=${transcriptLikeStructure}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      sessionPhase: stateName,
      continueHits,
      resetHits,
      questionCount: analysis.questionCount,
      userLabels,
      assistantLabels,
      transcriptLikeStructure,
      bidirectionalDialogue,
      hasText: Boolean(analysis.text),
      tokenCount: analysis.tokenCount,
    },
  };
}