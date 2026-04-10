import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface TurnRegistryInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface TurnRegistryOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function detectDominantRole(userMarkers: number, assistantMarkers: number): "user" | "assistant" | "balanced" | "none" {
  if (userMarkers === 0 && assistantMarkers === 0) return "none";
  if (userMarkers > assistantMarkers) return "user";
  if (assistantMarkers > userMarkers) return "assistant";
  return "balanced";
}

export function turnRegistry(input: TurnRegistryInput = {}): TurnRegistryOutput {
  const analysis = analyzeSignalText(input.text);
  const normalized = analysis.normalized || "";

  const userMarkers =
    countSignalMatches(normalized, /\b(?:user|usuario|usuário)\s*:/g) +
    countSignalMatches(normalized, /\b(?:user|usuario|usuário)\s*-\s*/g);

  const assistantMarkers =
    countSignalMatches(normalized, /\b(?:assistant|assistente|leticia|letícia)\s*:/g) +
    countSignalMatches(normalized, /\b(?:assistant|assistente|leticia|letícia)\s*-\s*/g);

  const explicitDialogueMarkers = userMarkers + assistantMarkers;

  const turnWords = countSignalMatches(
    normalized,
    /\b(?:turno|turn|mensagem|message|dialogo|diálogo|conversa|chat)\b/g,
  );

  const transcriptLikeLabels = countSignalMatches(
    normalized,
    /\b(?:usuario|usuário|user|assistant|assistente|leticia|letícia)\s*:/g,
  );

  const transcriptLikeDashes = countSignalMatches(
    normalized,
    /\b(?:usuario|usuário|user|assistant|assistente|leticia|letícia)\s*-\s*/g,
  );

  const repeatedRoleBlocks = countSignalMatches(
    normalized,
    /\b(?:usuario|usuário|user|assistant|assistente|leticia|letícia)\s*:/g,
  );

  const inferredTurnCount = Math.max(
    explicitDialogueMarkers,
    transcriptLikeLabels,
    transcriptLikeDashes,
    turnWords,
  );

  const hasExplicitDialogue = explicitDialogueMarkers > 0;
  const hasBidirectionalDialogue = userMarkers > 0 && assistantMarkers > 0;
  const hasTranscriptLikeStructure = transcriptLikeLabels + transcriptLikeDashes >= 2;
  const hasStrongTranscriptContamination =
    hasBidirectionalDialogue && hasTranscriptLikeStructure && inferredTurnCount >= 2;

  const dominantRoleMarker = detectDominantRole(userMarkers, assistantMarkers);

  const transcriptSignal =
    (Math.min(1, explicitDialogueMarkers / 6) * 0.42) +
    (hasBidirectionalDialogue ? 0.18 : 0) +
    (hasTranscriptLikeStructure ? 0.14 : 0) +
    (Math.min(1, turnWords / 4) * 0.12) +
    (Math.min(1, analysis.tokenCount / 32) * 0.14);

  const inferredScore = clamp01(0.08 + transcriptSignal);

  const finalScore =
    typeof input.score === "number" && Number.isFinite(input.score)
      ? clamp01(input.score)
      : inferredScore;

  return {
    ok: true,
    component: "turn-registry",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `turns=${inferredTurnCount}; userMarkers=${userMarkers}; assistantMarkers=${assistantMarkers}; transcriptLike=${hasTranscriptLikeStructure}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      inferredTurnCount,
      userMarkers,
      assistantMarkers,
      explicitDialogueMarkers,
      turnWords,
      transcriptLikeLabels,
      transcriptLikeDashes,
      repeatedRoleBlocks,
      hasExplicitDialogue,
      hasBidirectionalDialogue,
      hasTranscriptLikeStructure,
      hasStrongTranscriptContamination,
      dominantRoleMarker,
      hasText: Boolean(analysis.text),
      tokenCount: analysis.tokenCount,
    },
  };
}