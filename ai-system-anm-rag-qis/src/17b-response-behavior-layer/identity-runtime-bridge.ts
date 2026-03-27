import { resolveIdentityFallbackForMessage } from "./ai-identity-regulator";

export function resolveIdentityRuntimeFallback(message: string): string | null {
  const fallback = resolveIdentityFallbackForMessage(message);
  if (!fallback.shouldHandle) return null;
  return fallback.shortNarrative || null;
}
