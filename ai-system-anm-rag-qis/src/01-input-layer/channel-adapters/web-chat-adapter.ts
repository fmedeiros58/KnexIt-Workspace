export interface WebChatAdapterInput {
  text: string;
}

export interface WebChatAdapterOutput {
  message: string;
  channel: "web-chat";
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function webChatAdapter(input: WebChatAdapterInput): WebChatAdapterOutput {
  const message = (input.text || "").trim();
  return {
    message,
    channel: "web-chat",
    ok: true,
    component: "web-chat-adapter",
    score: message.length ? 0.8 : 0.2,
    detail: message,
    context: {},
  };
}
