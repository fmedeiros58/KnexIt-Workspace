export interface ApiAdapterInput {
  body: unknown;
}

export interface ApiAdapterOutput {
  message: string;
  channel: "api";
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function apiAdapter(input: ApiAdapterInput): ApiAdapterOutput {
  const body = input.body;
  let message = "";

  if (typeof body === "string") message = body;
  else if (body && typeof body === "object" && "message" in body && typeof (body as { message?: unknown }).message === "string") {
    message = (body as { message: string }).message;
  } else {
    message = JSON.stringify(body ?? {});
  }

  return {
    message,
    channel: "api",
    ok: true,
    component: "api-adapter",
    score: message.trim().length ? 0.84 : 0.2,
    detail: message,
    context: {
      payloadType: typeof body,
    },
  };
}
