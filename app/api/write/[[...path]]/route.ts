import { NextRequest } from "next/server";
import { readConfiguredAiSystemAnmBaseUrl, resolveReachableAiSystemAnmBaseUrl } from "@/app/api/_shared/ai-system-anm-endpoint";

export const runtime = "nodejs";

const DEFAULT_ANM_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_ANM_TIMEOUT_MS = 45_000;

type RouteContext = {
  params: { path?: string[] };
};

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return "";
}

function readAnmCompatEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readProxyConfig() {
  const anmBaseUrl = readConfiguredAiSystemAnmBaseUrl(
    pickFirstNonEmpty(readAnmCompatEnv("AI_SYSTEM_ANM_API_BASE_URL"), DEFAULT_ANM_BASE_URL),
  );
  const parsedTimeout = Number(
    readAnmCompatEnv("AI_SYSTEM_ANM_API_TIMEOUT_MS") || DEFAULT_ANM_TIMEOUT_MS,
  );
  const timeoutMs = Number.isFinite(parsedTimeout) ? Math.max(2_000, Math.round(parsedTimeout)) : DEFAULT_ANM_TIMEOUT_MS;
  return { anmBaseUrl, timeoutMs };
}

function buildTargetUrl(req: NextRequest, segments: string[], anmBaseUrl: string) {
  const safePath = segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const basePath = safePath ? `/write/${safePath}` : "/write";
  const search = req.nextUrl.search || "";
  return `${anmBaseUrl}${basePath}${search}`;
}

async function proxyWriteRequest(req: NextRequest, context: RouteContext) {
  const method = req.method.toUpperCase();
  const segments = context.params.path || [];
  const { anmBaseUrl, timeoutMs } = readProxyConfig();
  const anmResolution = await resolveReachableAiSystemAnmBaseUrl({
    configuredBaseUrl: anmBaseUrl,
    timeoutMs: Math.min(2_000, timeoutMs),
    healthPath: "/healthz",
  });
  const targetUrl = buildTargetUrl(req, segments, anmResolution.baseUrl);

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);
  const xRequestId = req.headers.get("x-request-id");
  if (xRequestId) headers.set("x-request-id", xRequestId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const hasBody = !["GET", "HEAD"].includes(method);
    const body = hasBody ? await req.arrayBuffer() : undefined;
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? body : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) responseHeaders.set("content-type", upstreamType);
    const upstreamRequestId = upstream.headers.get("x-request-id");
    if (upstreamRequestId) responseHeaders.set("x-request-id", upstreamRequestId);
    responseHeaders.set("x-anm-base-url", anmResolution.baseUrl);

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "WRITE_PROXY_TIMEOUT"
        : error instanceof Error
          ? error.message || "WRITE_PROXY_ERROR"
          : "WRITE_PROXY_ERROR";
    return Response.json(
      {
        ok: false,
        code: "WRITE_PROXY_ERROR",
        message: `${message}; ANM=${anmResolution.baseUrl}; tentados=${anmResolution.attemptedBaseUrls.join(",")}`,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  return proxyWriteRequest(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return proxyWriteRequest(req, context);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return proxyWriteRequest(req, context);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  return proxyWriteRequest(req, context);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return proxyWriteRequest(req, context);
}


