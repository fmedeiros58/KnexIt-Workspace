import { NextRequest } from "next/server";
import { readConfiguredAnmBaseUrl, resolveReachableAnmBaseUrl } from "@/app/api/_shared/anm-endpoint";

export const runtime = "nodejs";

const DEFAULT_ANM_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_ANM_TIMEOUT_MS = 45_000;

type SynthesizeRequestBody = {
  text?: unknown;
  localeHint?: unknown;
  locale_hint?: unknown;
  voiceId?: unknown;
  voice_id?: unknown;
  rate?: unknown;
  pitch?: unknown;
  style?: unknown;
};

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (normalized) return normalized;
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

function readAnmConfig() {
  const anmBaseUrl = readConfiguredAnmBaseUrl(
    pickFirstNonEmpty(readAnmCompatEnv("AI_SYSTEM_ANM_API_BASE_URL", "ANM_API_BASE_URL"), DEFAULT_ANM_BASE_URL),
  );
  const parsedTimeout = Number(
    readAnmCompatEnv("AI_SYSTEM_ANM_API_TIMEOUT_MS", "ANM_API_TIMEOUT_MS") || DEFAULT_ANM_TIMEOUT_MS,
  );
  const anmTimeoutMs = Number.isFinite(parsedTimeout) ? Math.max(4_000, Math.round(parsedTimeout)) : DEFAULT_ANM_TIMEOUT_MS;
  return { anmBaseUrl, anmTimeoutMs };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function parseRate(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return clamp(parsed, 0.75, 1.35);
}

function parsePitch(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return clamp(parsed, 0.7, 1.35);
}

async function parseErrorMessage(response: Response) {
  const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as { detail?: unknown; message?: unknown; code?: unknown } | null;
    return `${payload?.message || payload?.detail || payload?.code || ""}`.trim();
  }
  return (await response.text().catch(() => "")).trim();
}

function mapUpstreamSynthesizeError(detail: string, status: number) {
  const normalized = detail.trim().toLowerCase();
  if (normalized.includes("azure_speech_credentials_missing")) {
    return {
      code: "PROACTIVE_VOICE_AZURE_CREDENTIALS_MISSING",
      message:
        "Credenciais Azure Speech ausentes no ANM. Defina AZURE_SPEECH_KEY e AZURE_SPEECH_REGION (ou ANM_AZURE_SPEECH_KEY/ANM_AZURE_SPEECH_REGION) e reinicie o ANM.",
      status: 502,
    };
  }
  if (normalized.includes("azure_speech_sdk_not_installed")) {
    return {
      code: "PROACTIVE_VOICE_AZURE_SDK_MISSING",
      message: "SDK Azure Speech nao encontrado no ANM. Instale dependencias e reinicie o ANM.",
      status: 502,
    };
  }
  return {
    code: "PROACTIVE_VOICE_SYNTH_UPSTREAM_ERROR",
    message: detail || `Falha de sintese de voz (HTTP ${status}).`,
    status: status >= 500 ? 502 : status,
  };
}

export async function POST(req: NextRequest) {
  let attemptedAnmBaseUrls: string[] = [];
  try {
    const body = (await req.json().catch(() => ({}))) as SynthesizeRequestBody;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return Response.json(
        {
          ok: false,
          code: "PROACTIVE_VOICE_TEXT_REQUIRED",
          message: "Texto obrigatorio para sintese de voz.",
        },
        { status: 400 },
      );
    }

    const localeHint =
      (typeof body.localeHint === "string" && body.localeHint.trim()) ||
      (typeof body.locale_hint === "string" && body.locale_hint.trim()) ||
      "";
    const voiceId =
      (typeof body.voiceId === "string" && body.voiceId.trim()) ||
      (typeof body.voice_id === "string" && body.voice_id.trim()) ||
      "";
    const style = typeof body.style === "string" ? body.style.trim().slice(0, 40) : "";
    const rate = parseRate(body.rate);
    const pitch = parsePitch(body.pitch);

    const { anmBaseUrl, anmTimeoutMs } = readAnmConfig();
    const anmResolution = await resolveReachableAnmBaseUrl({
      configuredBaseUrl: anmBaseUrl,
      timeoutMs: Math.min(2_000, anmTimeoutMs),
      healthPath: "/healthz",
    });
    attemptedAnmBaseUrls = anmResolution.attemptedBaseUrls;
    const resolvedBaseUrl = anmResolution.baseUrl;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), anmTimeoutMs);
    try {
      const upstream = await fetch(`${resolvedBaseUrl}/assistant/leticia/synthesize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          text,
          locale_hint: localeHint || undefined,
          voice_id: voiceId || undefined,
          rate,
          pitch,
          style: style || undefined,
        }),
      });
      if (!upstream.ok) {
        const detail = await parseErrorMessage(upstream);
        const mapped = mapUpstreamSynthesizeError(detail, upstream.status);
        return Response.json(
          {
            ok: false,
            code: mapped.code,
            message: mapped.message,
            attempted_anm_base_urls: attemptedAnmBaseUrls,
          },
          { status: mapped.status },
        );
      }
      const contentType = upstream.headers.get("content-type") || "audio/mpeg";
      const payload = await upstream.arrayBuffer();
      return new Response(payload, {
        status: 200,
        headers: {
          "content-type": contentType,
          "cache-control": "no-store",
          "x-leticia-voice-id": upstream.headers.get("x-leticia-voice-id") || "",
          "x-leticia-voice-locale": upstream.headers.get("x-leticia-voice-locale") || "",
          "x-leticia-voice-provider": upstream.headers.get("x-leticia-voice-provider") || "azure",
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de sintese de voz da Leticia.";
    return Response.json(
      {
        ok: false,
        code: "PROACTIVE_VOICE_SYNTH_UNAVAILABLE",
        message,
        attempted_anm_base_urls: attemptedAnmBaseUrls,
      },
      { status: 503 },
    );
  }
}

