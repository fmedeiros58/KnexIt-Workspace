import { NextRequest } from "next/server";

export const runtime = "nodejs";
const DEFAULT_COMPAT_TIMEOUT_MS = 2_500;

function readCompatTimeoutMs() {
  const parsed = Number(
    process.env.AI_SYSTEM_IDENTITY_COMPAT_TIMEOUT_MS ||
      process.env.AI_SYSTEM_ANM_IDENTITY_COMPAT_TIMEOUT_MS ||
      DEFAULT_COMPAT_TIMEOUT_MS,
  );
  if (!Number.isFinite(parsed)) return DEFAULT_COMPAT_TIMEOUT_MS;
  return Math.max(300, Math.min(10_000, Math.round(parsed)));
}

export async function GET(req: NextRequest) {
  const target = new URL("/api/identity/runtime/status", req.url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), readCompatTimeoutMs());
  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers: {
        accept: req.headers.get("accept") || "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        ok: false,
        code: "IDENTITY_RUNTIME_PROXY_UNAVAILABLE",
        message: "Falha ao consultar /api/identity/runtime/status.",
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
