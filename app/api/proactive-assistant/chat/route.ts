import { NextRequest } from "next/server";

import {
  buildSharedIdentityRuntimePayload,
  readIdentityRuntimeStatus,
  resolveRequestOrigin,
} from "../_shared";

export const runtime = "nodejs";

type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

function normalizePrompt(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHistory(value: unknown): ChatHistoryItem[] {
  if (!Array.isArray(value)) return [];
  const normalized: ChatHistoryItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const role = (row as { role?: unknown }).role;
    const contentRaw = (row as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof contentRaw !== "string") continue;
    const content = contentRaw.trim();
    if (!content) continue;
    normalized.push({ role, content });
  }
  return normalized.slice(-20);
}

async function parseErrorMessage(response: Response) {
  const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as { message?: unknown; detail?: unknown; code?: unknown } | null;
    const message =
      (typeof payload?.message === "string" && payload.message.trim()) ||
      (typeof payload?.detail === "string" && payload.detail.trim()) ||
      "";
    const code = typeof payload?.code === "string" ? payload.code.trim() : "";
    if (message && code) return `${code}: ${message}`;
    if (message) return message;
    if (code) return code;
    return "";
  }
  const text = (await response.text().catch(() => "")).trim();
  return text.slice(0, 320);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const prompt = normalizePrompt(body.prompt ?? body.message);
  if (!prompt) {
    return Response.json(
      {
        ok: false,
        code: "PROACTIVE_PROMPT_REQUIRED",
        message: "Informe prompt (ou message) para conversar com o assistente proativo.",
      },
      { status: 400 },
    );
  }

  const history = normalizeHistory(body.history);
  const origin = resolveRequestOrigin(req);
  const identitySnapshot = await readIdentityRuntimeStatus(origin, 2_500);
  const sharedIdentityRuntime = buildSharedIdentityRuntimePayload(identitySnapshot);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  try {
    const upstream = await fetch(`${origin}/api/knexai`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        prompt,
        history,
        sharedIdentityRuntime: sharedIdentityRuntime || undefined,
      }),
    });
    if (!upstream.ok) {
      const detail = await parseErrorMessage(upstream);
      return Response.json(
        {
          ok: false,
          code: "PROACTIVE_UPSTREAM_ERROR",
          message: detail || `Falha ao consultar o motor proativo (HTTP ${upstream.status}).`,
        },
        { status: upstream.status >= 500 ? 502 : upstream.status },
      );
    }

    const headers = new Headers();
    headers.set("cache-control", "no-store");
    headers.set("content-type", upstream.headers.get("content-type") || "text/plain; charset=utf-8");
    const upstreamRequestId = upstream.headers.get("x-request-id");
    if (upstreamRequestId) headers.set("x-request-id", upstreamRequestId);

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    return Response.json(
      {
        ok: false,
        code: isTimeout ? "PROACTIVE_TIMEOUT" : "PROACTIVE_UNAVAILABLE",
        message: isTimeout
          ? "Tempo limite ao consultar o assistente proativo."
          : "Assistente proativo indisponivel no momento.",
      },
      { status: isTimeout ? 504 : 503 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

