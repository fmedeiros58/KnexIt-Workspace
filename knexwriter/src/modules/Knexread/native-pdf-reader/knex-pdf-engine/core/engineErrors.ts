export class KnexPdfEngineError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "KnexPdfEngineError";
  }
}

export function isRenderCancellation(error: unknown) {
  if (!error) return false;
  const maybe = error as { name?: unknown; message?: unknown };
  const name = typeof maybe.name === "string" ? maybe.name : "";
  const message = typeof maybe.message === "string" ? maybe.message : "";
  return (
    name === "AbortError" ||
    name === "RenderingCancelledException" ||
    /rendering cancelled|render canceled|abort|cancel/i.test(message)
  );
}
