import { resolveIdentityFallbackForMessage } from "./ai-identity-regulator";

export function resolveIdentityRuntimeFallback(message: string): string | null {
  const fallback = resolveIdentityFallbackForMessage(message);
  if (!fallback.shouldHandle) return null;
  if (fallback.nameOriginQuestionDetected) {
    return fallback.longNarrative || fallback.shortNarrative || null;
  }
  return fallback.shortNarrative || null;
}
