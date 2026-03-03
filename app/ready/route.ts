import { NextRequest } from "next/server";

import { createPublicApiContext, handlePublicApiPreflight, jsonWithCors } from "@/app/api/_shared/public-api";
import { loadRagLlmConfig } from "@/core/rag/rag-config";
import { createVectorDatabaseClient } from "@/core/database/vector-client";
import { logger } from "@/core/utils/logger";

export const runtime = "nodejs";

const ROUTE_OPTIONS = { methods: ["GET"], requireApiKey: false } as const;

type DependencyProbe = {
  ok: boolean;
  elapsedMs: number;
  detail: string;
};

async function probeVectorDb(): Promise<DependencyProbe> {
  const startedAt = Date.now();
  const client = createVectorDatabaseClient();
  try {
    await client.query("select 1 as ok");
    return { ok: true, elapsedMs: Date.now() - startedAt, detail: "vector db reachable" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "vector db unavailable";
    return { ok: false, elapsedMs: Date.now() - startedAt, detail: message };
  } finally {
    await client.close().catch(() => null);
  }
}

async function probeInternalLlm(): Promise<DependencyProbe> {
  const startedAt = Date.now();
  const config = loadRagLlmConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        elapsedMs: Date.now() - startedAt,
        detail: `llm HTTP ${response.status}${body ? ` (${body.slice(0, 120)})` : ""}`,
      };
    }
    return { ok: true, elapsedMs: Date.now() - startedAt, detail: "llm reachable" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, elapsedMs: Date.now() - startedAt, detail: "llm timeout" };
    }
    const message = error instanceof Error ? error.message : "llm unavailable";
    return { ok: false, elapsedMs: Date.now() - startedAt, detail: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

function probeCriticalConfig(): DependencyProbe {
  const startedAt = Date.now();
  const env = process.env;
  const isProd = env.NODE_ENV === "production";
  const publicOriginsConfigured = Boolean(
    (env.PUBLIC_API_ALLOWED_ORIGINS || "").trim() ||
      (env.VERCEL_FRONTEND_ORIGIN || "").trim() ||
      (env.APP_PUBLIC_ORIGIN || "").trim(),
  );
  const publicApiKeyConfigured = Boolean((env.PUBLIC_API_KEY || "").trim() || (env.PUBLIC_API_KEYS || "").trim());
  const llm = loadRagLlmConfig();
  const hasInternalLlmUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(llm.baseUrl);

  if (isProd && !publicOriginsConfigured) {
    return {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      detail: "PUBLIC_API_ALLOWED_ORIGINS/VERCEL_FRONTEND_ORIGIN nao configurado em producao.",
    };
  }
  if (isProd && !publicApiKeyConfigured) {
    return {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      detail: "PUBLIC_API_KEY(S) nao configurada em producao.",
    };
  }
  if (llm.requireInternalBaseUrl && !hasInternalLlmUrl) {
    return {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      detail: "RAG_LLM_BASE_URL fora de endereco interno permitido.",
    };
  }
  return {
    ok: true,
    elapsedMs: Date.now() - startedAt,
    detail: "critical config loaded",
  };
}

export async function OPTIONS(req: NextRequest) {
  return handlePublicApiPreflight(req, ROUTE_OPTIONS);
}

export async function GET(req: NextRequest) {
  const context = createPublicApiContext(req);
  const [vectorDb, llm] = await Promise.all([probeVectorDb(), probeInternalLlm()]);
  const criticalConfig = probeCriticalConfig();
  const ready = vectorDb.ok && llm.ok && criticalConfig.ok;
  logger.info("PUBLIC_READY_CHECK", {
    requestId: context.requestId,
    ready,
    vectorDbOk: vectorDb.ok,
    llmOk: llm.ok,
    configOk: criticalConfig.ok,
    forwardedHeadersPresent: context.forwardedHeadersPresent,
  });

  return jsonWithCors(
    context,
    {
      ok: ready,
      status: ready ? "ready" : "not_ready",
      service: "knexspace-api",
      time: new Date().toISOString(),
      dependencies: {
        vectorDb,
        llm,
        criticalConfig,
      },
      request: {
        requestId: context.requestId,
        clientIp: context.clientIp,
        forwardedProto: context.forwardedProto,
        forwardedHost: context.forwardedHost,
        publicBaseUrl: context.publicBaseUrl,
        forwardedHeadersPresent: context.forwardedHeadersPresent,
      },
    },
    ready ? 200 : 503,
    { methods: ROUTE_OPTIONS.methods },
  );
}
