import { NextRequest } from "next/server";

export const runtime = "nodejs";
const DEFAULT_HEALTHZ_COMPAT_TIMEOUT_MS = 2_500;

function readHealthzCompatTimeoutMs() {
  const parsed = Number(
    process.env.AI_SYSTEM_HEALTHZ_COMPAT_TIMEOUT_MS ||
      process.env.AI_SYSTEM_ANM_HEALTHZ_COMPAT_TIMEOUT_MS ||
      DEFAULT_HEALTHZ_COMPAT_TIMEOUT_MS,
  );
  if (!Number.isFinite(parsed)) return DEFAULT_HEALTHZ_COMPAT_TIMEOUT_MS;
  return Math.max(300, Math.min(10_000, Math.round(parsed)));
}

export async function GET(req: NextRequest) {
  const target = new URL("/api/healthz", req.url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), readHealthzCompatTimeoutMs());
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
        code: "HEALTHZ_PROXY_UNAVAILABLE",
        message: "Falha ao consultar /api/healthz.",
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
