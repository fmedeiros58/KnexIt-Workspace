export interface ModalityDetectorInput {
  text: string;
  channelHint?: "text" | "voice" | "api";
}

export interface ModalityDetectorOutput {
  modality: "text" | "voice" | "api";
  confidence: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function modalityDetector(input: ModalityDetectorInput): ModalityDetectorOutput {
  if (input.channelHint) {
    return {
      modality: input.channelHint,
      confidence: 0.94,
      ok: true,
      component: "modality-detector",
      score: 0.94,
      detail: input.channelHint,
      context: { source: "channel_hint" },
    };
  }

  const text = input.text || "";
  const lower = text.toLowerCase();
  const voiceSignal = /\b(transcri[cç][aã]o|dictado|dictation|voz|audio)\b/.test(lower);
  const apiSignal = /\b(json|http|endpoint|status code|curl|api)\b/.test(lower);

  const modality: "text" | "voice" | "api" = voiceSignal ? "voice" : apiSignal ? "api" : "text";
  const confidence = voiceSignal || apiSignal ? 0.82 : 0.68;

  return {
    modality,
    confidence,
    ok: true,
    component: "modality-detector",
    score: Number(confidence.toFixed(4)),
    detail: modality,
    context: {
      voiceSignal,
      apiSignal,
    },
  };
}
