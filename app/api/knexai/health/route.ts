import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_BASE_URL = "http://127.0.0.1:8000/v1";
const DEFAULT_MODEL = "mistral-awq";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_ANM_BASE_URL = "http://127.0.0.1:8100";
const DEFAULT_ANM_TIMEOUT_MS = 8_000;

type EngineMode = "direct" | "anm";

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return "";
}

function resolveLogicalModelName() {
  const explicit = pickFirstNonEmpty(process.env.LLM_MODEL_NAME);
  if (explicit) return explicit;

  const legacy = pickFirstNonEmpty(process.env.VLLM_MODEL);
  if (legacy && !legacy.includes("/") && !legacy.includes("\\")) return legacy;

  return DEFAULT_MODEL;
}

function readLlmConfig() {
  const baseUrl = pickFirstNonEmpty(process.env.LOCAL_LLM_BASE_URL, process.env.LLM_BASE_URL, process.env.VLLM_BASE_URL, DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const model = resolveLogicalModelName();
  const apiKey = pickFirstNonEmpty(process.env.LOCAL_LLM_API_KEY, process.env.VLLM_API_KEY, process.env.LLM_API_KEY, "token-local");
  const timeout = Number(process.env.LLM_TIMEOUT_MS || process.env.VLLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeout) ? Math.max(2_000, timeout) : DEFAULT_TIMEOUT_MS;
  return { baseUrl, model, apiKey, timeoutMs };
}

function readEngineModeConfig() {
  const modeRaw = pickFirstNonEmpty(process.env.KNEXAI_ENGINE_MODE, "direct").toLowerCase();
  const mode: EngineMode = modeRaw === "anm" ? "anm" : "direct";
  const anmBaseUrl = pickFirstNonEmpty(process.env.ANM_BACKEND_BASE_URL, DEFAULT_ANM_BASE_URL).replace(/\/+$/, "");
  const parsedTimeout = Number(process.env.ANM_BACKEND_TIMEOUT_MS || DEFAULT_ANM_TIMEOUT_MS);
  const anmTimeoutMs = Number.isFinite(parsedTimeout) ? Math.max(2_000, parsedTimeout) : DEFAULT_ANM_TIMEOUT_MS;
  const fallbackRaw = pickFirstNonEmpty(process.env.KNEXAI_ANM_FALLBACK_TO_DIRECT, "1").toLowerCase();
  const fallbackToDirect = !["0", "false", "no", "off"].includes(fallbackRaw);
  return { mode, anmBaseUrl, anmTimeoutMs, fallbackToDirect };
}

async function probeAnm(baseUrl: string, timeoutMs: number) {
  const endpoints = ["/healthz", "/admin/health"];
  const startedAt = Date.now();
  let lastStatus = 0;
  let lastMessage = "";

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
      lastStatus = response.status;
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        return {
          ok: true,
          endpoint,
          status: response.status,
          elapsedMs: Date.now() - startedAt,
          payload,
          error: null,
        };
      }
      const bodyText = await response.text().catch(() => "");
      lastMessage = bodyText.slice(0, 200);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        lastStatus = 504;
        lastMessage = "timeout";
      } else {
        lastStatus = 503;
        lastMessage = "unreachable";
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    ok: false,
    endpoint: null,
    status: lastStatus || 503,
    elapsedMs: Date.now() - startedAt,
    payload: null,
    error: lastMessage || "ANM backend indisponivel.",
  };
}

export async function GET() {
  const engineMode = readEngineModeConfig();

  if (engineMode.mode === "anm") {
    const anmProbe = await probeAnm(engineMode.anmBaseUrl, engineMode.anmTimeoutMs);
    if (!anmProbe.ok) {
      return NextResponse.json(
        {
          ok: false,
          provider: "anm",
          engineMode: engineMode.mode,
          anmReachable: false,
          anmBaseUrl: engineMode.anmBaseUrl,
          anmFallbackToDirect: engineMode.fallbackToDirect,
          status: anmProbe.status,
          elapsedMs: anmProbe.elapsedMs,
          message: anmProbe.error,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        provider: "anm",
        engineMode: engineMode.mode,
        anmReachable: true,
        anmBaseUrl: engineMode.anmBaseUrl,
        anmEndpoint: anmProbe.endpoint,
        anmFallbackToDirect: engineMode.fallbackToDirect,
        status: anmProbe.status,
        elapsedMs: anmProbe.elapsedMs,
        payload: anmProbe.payload,
      },
      { status: 200 },
    );
  }

  const config = readLlmConfig();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const elapsedMs = Date.now() - startedAt;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          provider: "direct",
          engineMode: engineMode.mode,
          llmReachable: false,
          status: response.status,
          model: config.model,
          baseUrl: config.baseUrl,
          elapsedMs,
          message: `LLM respondeu com erro HTTP ${response.status}.`,
          bodySnippet: body.slice(0, 200),
        },
        { status: 503 },
      );
    }

    const payload = await response.json().catch(() => null);
    const listedModels = Array.isArray((payload as { data?: unknown[] } | null)?.data)
      ? ((payload as { data: Array<{ id?: string }> }).data ?? [])
          .map((item) => item?.id)
          .filter((id): id is string => typeof id === "string")
      : [];

    return NextResponse.json(
      {
        ok: true,
        provider: "direct",
        engineMode: engineMode.mode,
        llmReachable: true,
        status: 200,
        model: config.model,
        modelAvailable: listedModels.length ? listedModels.includes(config.model) : null,
        listedModels: listedModels.slice(0, 20),
        baseUrl: config.baseUrl,
        elapsedMs,
      },
      { status: 200 },
    );
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const maybeCause = typeof error === "object" && error && "cause" in error ? (error as { cause?: { code?: string } }).cause : null;
    const code = maybeCause?.code || "";
    const connectivityCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH"]);
    const suffix = connectivityCodes.has(code) ? ` (${code})` : "";
    return NextResponse.json(
      {
        ok: false,
        provider: "direct",
        engineMode: engineMode.mode,
        llmReachable: false,
        status: isTimeout ? 504 : 503,
        model: config.model,
        baseUrl: config.baseUrl,
        elapsedMs,
        message: isTimeout
          ? `Timeout ao consultar LLM em ${config.baseUrl}.`
          : `Nao foi possivel conectar ao LLM em ${config.baseUrl}${suffix}.`,
      },
      { status: isTimeout ? 504 : 503 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
