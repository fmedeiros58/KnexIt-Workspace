export interface VoiceAdapterInput {
  transcript: string;
}

export interface VoiceAdapterOutput {
  message: string;
  channel: "voice";
  confidence: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function voiceAdapter(input: VoiceAdapterInput): VoiceAdapterOutput {
  const message = (input.transcript || "").trim();
  const confidence = message.length > 0 ? 0.76 : 0.2;
  return {
    message,
    channel: "voice",
    confidence,
    ok: true,
    component: "voice-adapter",
    score: Number(confidence.toFixed(4)),
    detail: message,
    context: {},
  };
}
