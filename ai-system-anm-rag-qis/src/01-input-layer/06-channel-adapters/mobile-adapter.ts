export interface MobileAdapterInput {
  text: string;
}

export interface MobileAdapterOutput {
  message: string;
  channel: "mobile";
  compressionHint: "short" | "normal";
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function mobileAdapter(input: MobileAdapterInput): MobileAdapterOutput {
  const message = input.text || "";
  const compressionHint: "short" | "normal" = message.length > 900 ? "short" : "normal";
  return {
    message,
    channel: "mobile",
    compressionHint,
    ok: true,
    component: "mobile-adapter",
    score: 0.78,
    detail: message,
    context: {
      length: message.length,
    },
  };
}
