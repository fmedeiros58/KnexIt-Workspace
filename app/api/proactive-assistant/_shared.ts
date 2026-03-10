import { NextRequest } from "next/server";

export type IdentityRuntimeSnapshot = {
  status?: string;
  awareness_state?: Record<string, unknown>;
  current_identity?: Record<string, unknown> | null;
  tracked_entities?: unknown[];
};

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (normalized) return normalized;
  }
  return "";
}

export function resolveRequestOrigin(req: NextRequest) {
  const forwardedProto = pickFirstNonEmpty(req.headers.get("x-forwarded-proto"));
  const forwardedHost = pickFirstNonEmpty(req.headers.get("x-forwarded-host"));
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return req.nextUrl.origin;
}

export async function readIdentityRuntimeStatus(origin: string, timeoutMs = 2_000): Promise<IdentityRuntimeSnapshot | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${origin}/api/identity/runtime/status`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as IdentityRuntimeSnapshot | null;
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildSharedIdentityRuntimePayload(snapshot: IdentityRuntimeSnapshot | null) {
  if (!snapshot) return null;
  const awareness = snapshot.awareness_state && typeof snapshot.awareness_state === "object" ? snapshot.awareness_state : {};
  const currentIdentity = snapshot.current_identity && typeof snapshot.current_identity === "object" ? snapshot.current_identity : null;
  const trackedEntities = Array.isArray(snapshot.tracked_entities) ? snapshot.tracked_entities.slice(0, 8) : [];
  return {
    source: "identity_runtime_status",
    captured_at: new Date().toISOString(),
    status: typeof snapshot.status === "string" ? snapshot.status : "unknown",
    awareness_state: awareness,
    current_identity: currentIdentity,
    tracked_entities: trackedEntities,
  };
}

