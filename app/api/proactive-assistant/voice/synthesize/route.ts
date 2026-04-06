import { NextRequest } from "next/server";
import { readConfiguredAiSystemAnmBaseUrl, resolveReachableAiSystemAnmBaseUrl } from "@/app/api/_shared/ai-system-anm-endpoint";

export const runtime = "nodejs";

const DEFAULT_AI_SYSTEM_ANM_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_AI_SYSTEM_ANM_TIMEOUT_MS = 45_000;

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

type AzureSpeechConfig = {
  key: string;
  region: string;
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
  const anmBaseUrl = readConfiguredAiSystemAnmBaseUrl(
    pickFirstNonEmpty(readAnmCompatEnv("AI_SYSTEM_ANM_API_BASE_URL"), DEFAULT_AI_SYSTEM_ANM_BASE_URL),
  );
  const parsedTimeout = Number(
    readAnmCompatEnv("AI_SYSTEM_ANM_API_TIMEOUT_MS") || DEFAULT_AI_SYSTEM_ANM_TIMEOUT_MS,
  );
  const anmTimeoutMs = Number.isFinite(parsedTimeout) ? Math.max(4_000, Math.round(parsedTimeout)) : DEFAULT_AI_SYSTEM_ANM_TIMEOUT_MS;
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
        "Credenciais Azure Speech ausentes no runtime. Defina AZURE_SPEECH_KEY e AZURE_SPEECH_REGION e reinicie o runtime.",
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

function readAzureSpeechConfig(): AzureSpeechConfig | null {
  const key = pickFirstNonEmpty(process.env.AZURE_SPEECH_KEY);
  const region = pickFirstNonEmpty(process.env.AZURE_SPEECH_REGION);
  if (!key || !region) return null;
  return { key, region };
}

function resolveVoiceId(localeHint: string, requestedVoiceId: string) {
  if (requestedVoiceId) return requestedVoiceId;
  const locale = `${localeHint || ""}`.trim().toLowerCase();
  if (locale.startsWith("en")) return "en-US-JennyNeural";
  if (locale.startsWith("es")) return "es-ES-ElviraNeural";
  return "pt-BR-BrendaNeural";
}

function buildProsodyRate(rate: number) {
  const clamped = clamp(rate, 0.75, 1.35);
  const pct = Math.round((clamped - 1) * 100);
  if (pct >= 0) return `+${pct}%`;
  return `${pct}%`;
}

function buildProsodyPitch(pitch: number) {
  const clamped = clamp(pitch, 0.7, 1.35);
  const pct = Math.round((clamped - 1) * 100);
  if (pct >= 0) return `+${pct}%`;
  return `${pct}%`;
}

function escapeSsml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSsml(input: {
  text: string;
  localeHint: string;
  voiceId: string;
  rate: number;
  pitch: number;
  style: string;
}) {
  const locale = `${input.localeHint || ""}`.trim() || "pt-BR";
  const escapedText = escapeSsml(input.text);
  const rate = buildProsodyRate(input.rate);
  const pitch = buildProsodyPitch(input.pitch);
  const style = `${input.style || ""}`.trim().toLowerCase();
  const hasStyle = ["chat", "friendly", "calm", "assistant", "customerservice"].includes(style);

  if (hasStyle) {
    return [
      `<speak version="1.0" xml:lang="${locale}" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts">`,
      `<voice name="${input.voiceId}">`,
      `<mstts:express-as style="${style}"><prosody rate="${rate}" pitch="${pitch}">${escapedText}</prosody></mstts:express-as>`,
      `</voice>`,
      `</speak>`,
    ].join("");
  }

  return [
    `<speak version="1.0" xml:lang="${locale}" xmlns="http://www.w3.org/2001/10/synthesis">`,
    `<voice name="${input.voiceId}">`,
    `<prosody rate="${rate}" pitch="${pitch}">${escapedText}</prosody>`,
    `</voice>`,
    `</speak>`,
  ].join("");
}

async function synthesizeWithAzureSpeech(input: {
  text: string;
  localeHint: string;
  voiceId: string;
  rate: number;
  pitch: number;
  style: string;
}) {
  const azure = readAzureSpeechConfig();
  if (!azure) {
    return {
      ok: false as const,
      code: "PROACTIVE_VOICE_AZURE_CREDENTIALS_MISSING",
      message: "Credenciais Azure Speech ausentes no runtime.",
      status: 503,
    };
  }

  let sdk: {
    SpeechConfig: {
      fromSubscription: (key: string, region: string) => {
        speechSynthesisVoiceName: string;
        speechSynthesisLanguage?: string;
        speechSynthesisOutputFormat?: unknown;
      };
    };
    AudioConfig: {
      fromAudioFileOutput: (...args: unknown[]) => unknown;
    };
    SpeechSynthesizer: new (
      speechConfig: {
        speechSynthesisVoiceName: string;
        speechSynthesisLanguage?: string;
        speechSynthesisOutputFormat?: unknown;
      },
      audioConfig?: unknown,
    ) => {
      speakSsmlAsync: (
        ssml: string,
        cb: (result: { audioData?: ArrayBuffer | Uint8Array; reason?: unknown }) => void,
        errCb: (error: string) => void,
      ) => void;
      close: () => void;
    };
    SpeechSynthesisOutputFormat?: Record<string, unknown>;
  };

  try {
    sdk = (await import("microsoft-cognitiveservices-speech-sdk")) as unknown as typeof sdk;
  } catch {
    return {
      ok: false as const,
      code: "PROACTIVE_VOICE_AZURE_SDK_MISSING",
      message: "SDK Azure Speech nao encontrado no runtime.",
      status: 503,
    };
  }

  const speechConfig = sdk.SpeechConfig.fromSubscription(azure.key, azure.region);
  const voiceId = resolveVoiceId(input.localeHint, input.voiceId);
  speechConfig.speechSynthesisVoiceName = voiceId;
  const locale = `${input.localeHint || ""}`.trim();
  if (locale) speechConfig.speechSynthesisLanguage = locale;
  const mp3Format = sdk.SpeechSynthesisOutputFormat?.Audio24Khz160KBitRateMonoMp3;
  if (mp3Format) {
    speechConfig.speechSynthesisOutputFormat = mp3Format;
  }

  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
  const ssml = buildSsml({
    text: input.text,
    localeHint: input.localeHint,
    voiceId,
    rate: input.rate,
    pitch: input.pitch,
    style: input.style,
  });

  try {
    const audioData = await new Promise<Uint8Array>((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          const payload = result?.audioData;
          if (!payload) {
            reject(new Error("azure_speech_empty_audio"));
            return;
          }
          if (payload instanceof Uint8Array) {
            resolve(payload);
            return;
          }
          resolve(new Uint8Array(payload));
        },
        (error) => reject(new Error(`${error || "azure_speech_synthesis_failed"}`)),
      );
    });

    return {
      ok: true as const,
      voiceId,
      payload: audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength),
      contentType: "audio/mpeg",
      provider: "azure-direct",
      locale: locale || "pt-BR",
    };
  } catch (error) {
    return {
      ok: false as const,
      code: "PROACTIVE_VOICE_AZURE_SYNTH_FAILED",
      message: error instanceof Error ? error.message : "azure_speech_synthesis_failed",
      status: 502,
    };
  } finally {
    try {
      synthesizer.close();
    } catch {
      // no-op
    }
  }
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
    const anmResolution = await resolveReachableAiSystemAnmBaseUrl({
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
        // Endpoint legado inexistente no produto canônico: usar fallback local Azure Speech.
        if (upstream.status === 404 || upstream.status === 405 || upstream.status === 501) {
          const localVoice = await synthesizeWithAzureSpeech({
            text,
            localeHint,
            voiceId,
            rate,
            pitch,
            style,
          });
          if (localVoice.ok) {
            return new Response(localVoice.payload, {
              status: 200,
              headers: {
                "content-type": localVoice.contentType,
                "cache-control": "no-store",
                "x-leticia-voice-id": localVoice.voiceId,
                "x-leticia-voice-locale": localVoice.locale,
                "x-leticia-voice-provider": localVoice.provider,
              },
            });
          }
          return Response.json(
            {
              ok: false,
              code: localVoice.code,
              message: localVoice.message,
              attempted_anm_base_urls: attemptedAnmBaseUrls,
              fallback_local_tts: true,
            },
            { status: localVoice.status },
          );
        }

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


