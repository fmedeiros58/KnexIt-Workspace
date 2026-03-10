import { NextRequest } from "next/server";

export const runtime = "nodejs";

const DEFAULT_EMBEDDING_BASE_URL = "http://127.0.0.1:8001/v1";
const DEFAULT_TIMEOUT_MS = 45_000;

type FaceEmbeddingPayload = {
  input: string | string[];
  detect_face?: boolean;
  output_dimension?: number;
  model?: string;
};

function normalizeUrl(value: string) {
  const normalized = `${value || ""}`.trim().replace(/\/+$/, "");
  if (!normalized) return "";
  return normalized;
}

function resolveEmbeddingTargets() {
  const primary = normalizeUrl(process.env.EMBEDDING_BASE_URL || DEFAULT_EMBEDDING_BASE_URL);
  const fallbacks = `${process.env.EMBEDDING_BASE_URL_FALLBACKS || ""}`
    .split(",")
    .map((item) => normalizeUrl(item))
    .filter(Boolean);
  const all = [primary, ...fallbacks].filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const candidate of all) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    unique.push(candidate);
  }
  return unique;
}

function resolveAuthHeaders(): Record<string, string> {
  const apiKey = `${process.env.EMBEDDING_API_KEY || process.env.EMBEDDING_CPU_API_KEY || ""}`.trim();
  const headers: Record<string, string> = {};
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return headers;
}

function parseTimeoutMs() {
  const parsed = Number(process.env.EMBEDDING_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.max(5_000, Math.min(180_000, Math.round(parsed)));
}

function normalizeInput(payload: FaceEmbeddingPayload) {
  const raw = payload.input;
  const items = (Array.isArray(raw) ? raw : [raw]).map((item) => `${item || ""}`.trim()).filter(Boolean);
  if (!items.length) return null;
  const unique = Array.from(new Set(items)).slice(0, 16);
  return unique.length === 1 ? unique[0] : unique;
}

export async function POST(req: NextRequest) {
  try {
    const incoming = (await req.json().catch(() => ({}))) as FaceEmbeddingPayload;
    const input = normalizeInput(incoming);
    if (!input) {
      return Response.json({ ok: false, message: "input de imagem obrigatorio." }, { status: 400 });
    }

    const requestBody: FaceEmbeddingPayload = {
      input,
      detect_face: incoming.detect_face ?? true,
      output_dimension: Math.max(64, Math.min(2048, Number(incoming.output_dimension || 768))),
      model: typeof incoming.model === "string" && incoming.model.trim() ? incoming.model.trim() : undefined,
    };

    const targets = resolveEmbeddingTargets();
    if (!targets.length) {
      return Response.json({ ok: false, message: "Embedding base URL nao configurada." }, { status: 500 });
    }

    const timeoutMs = parseTimeoutMs();
    const headers = {
      "content-type": "application/json",
      ...resolveAuthHeaders(),
    };

    let lastError = "face_embedding_unavailable";
    for (const base of targets) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const target = base.endsWith("/v1") ? `${base}/face-embeddings` : `${base}/v1/face-embeddings`;
        const response = await fetch(target, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timeoutId);
        const body = await response.text();
        if (!response.ok) {
          lastError = body || `face_embedding_http_${response.status}`;
          continue;
        }
        return new Response(body, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error instanceof Error ? error.message : "face_embedding_request_failed";
      }
    }

    return Response.json({ ok: false, message: lastError }, { status: 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "face_embedding_proxy_failed";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

