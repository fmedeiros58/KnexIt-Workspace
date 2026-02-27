import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_BASE_URL = "http://127.0.0.1:8000/v1";
const DEFAULT_MODEL = "mistral-awq";
const DEFAULT_TIMEOUT_MS = 8_000;

function readConfig() {
  const baseUrl = (process.env.LLM_BASE_URL || process.env.VLLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.LLM_MODEL_NAME || process.env.VLLM_MODEL || DEFAULT_MODEL;
  const apiKey = process.env.LLM_API_KEY || process.env.VLLM_API_KEY || "EMPTY";
  const timeout = Number(process.env.LLM_TIMEOUT_MS || process.env.VLLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeout) ? Math.max(2_000, timeout) : DEFAULT_TIMEOUT_MS;
  return { baseUrl, model, apiKey, timeoutMs };
}

export async function GET() {
  const config = readConfig();
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
          llmReachable: false,
          status: response.status,
          model: config.model,
          baseUrl: config.baseUrl,
          elapsedMs,
          message: "LLM respondeu com erro.",
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
    return NextResponse.json(
      {
        ok: false,
        llmReachable: false,
        status: isTimeout ? 504 : 503,
        model: config.model,
        baseUrl: config.baseUrl,
        elapsedMs,
        message: isTimeout ? "Timeout ao consultar LLM." : "Nao foi possivel conectar ao LLM.",
      },
      { status: isTimeout ? 504 : 503 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
