import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";

export const runtime = "nodejs";

const IDENTITY_SCHEMA = (process.env.AI_SYSTEM_ANM_IDENTITY_SQL_SCHEMA || "knex_identity_runtime").trim();

type RecognitionLayerInput = {
  layer_key?: string;
  layer_name?: string;
  layer_result?: string;
  layer_score?: number;
  layer_payload?: Record<string, unknown>;
};

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function clamp01(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeEmbedding(value: unknown, maxDim = 768) {
  if (!Array.isArray(value)) return null;
  const normalized: number[] = [];
  for (const item of value) {
    const parsed = Number(item);
    if (!Number.isFinite(parsed)) continue;
    normalized.push(parsed);
    if (normalized.length >= maxDim) break;
  }
  if (!normalized.length) return null;
  return normalized;
}

function asVectorLiteral(values: number[] | null) {
  if (!values || !values.length) return null;
  return `[${values.map((item) => Number(item).toFixed(8)).join(",")}]`;
}

function normalizeLayerResult(value: unknown) {
  const normalized = asNonEmptyString(value).toLowerCase();
  if (normalized === "pass" || normalized === "fail" || normalized === "review") return normalized;
  return "review";
}

function normalizeMatchStatus(value: unknown, similarityScore: number, positiveThreshold: number) {
  const normalized = asNonEmptyString(value).toLowerCase();
  if (normalized === "positive" || normalized === "review" || normalized === "rejected") return normalized;
  return similarityScore >= positiveThreshold ? "positive" : "review";
}

function isSchemaProfileError(message: unknown) {
  const text = typeof message === "string" ? message : "";
  return /schema must be one of/i.test(text);
}

function tableRef(admin: ReturnType<typeof identitySupabaseAdmin>, table: string, useScopedSchema: boolean) {
  return useScopedSchema ? admin.schema(IDENTITY_SCHEMA).from(table) : admin.from(table);
}

export async function POST(req: NextRequest) {
  try {
    const admin = identitySupabaseAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const probe = ((body.probe as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    const match = ((body.match as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    const layersRaw = Array.isArray(body.layers) ? (body.layers as RecognitionLayerInput[]) : [];

    const candidateImageKey = asNonEmptyString(match.candidate_image_key);
    if (!candidateImageKey) {
      return Response.json({ ok: false, message: "candidate_image_key e obrigatorio." }, { status: 400 });
    }

    const findCandidate = async (useScopedSchema: boolean) =>
      tableRef(admin, "identity_image_assets", useScopedSchema).select("image_key").eq("image_key", candidateImageKey).maybeSingle();

    let candidateResult = await findCandidate(true);
    if (candidateResult.error && isSchemaProfileError(candidateResult.error.message)) {
      candidateResult = await findCandidate(false);
    }
    if (candidateResult.error) {
      return Response.json({ ok: false, message: candidateResult.error.message }, { status: 500 });
    }
    if (!candidateResult.data) {
      return Response.json({ ok: false, message: "candidate_image_key nao encontrado no banco de imagens." }, { status: 400 });
    }

    const captureKey = asNonEmptyString(probe.capture_key) || randomUUID();
    const matchKey = asNonEmptyString(match.match_key) || randomUUID();

    const sourceKey = asNonEmptyString(probe.source_key || body.source_key || "") || null;
    const entityKey = asNonEmptyString(probe.entity_key || body.entity_key || "") || null;
    const captureView = asNonEmptyString(probe.capture_view || body.capture_view || "").toLowerCase() || "unknown";
    const probeConfidence = clamp01(probe.confidence, 0.5);
    const similarityScore = clamp01(match.similarity_score, 0);
    const positiveThreshold = clamp01(match.positive_threshold, 0.72);
    const embedding = normalizeEmbedding(probe.embedding);
    const embeddingLiteral = asVectorLiteral(embedding);
    const matchStatus = normalizeMatchStatus(match.match_status, similarityScore, positiveThreshold);

    const capturePayload = {
      capture_key: captureKey,
      entity_key: entityKey,
      source_key: sourceKey,
      capture_view: captureView,
      embedding: embeddingLiteral,
      model_name: asNonEmptyString(probe.model_name) || null,
      confidence: probeConfidence,
      metadata: {
        origin: "identity_runtime_recognition_event",
        embedding_dims: embedding?.length || 0,
        raw_payload: typeof probe.metadata === "object" && probe.metadata ? probe.metadata : {},
      },
    };

    const upsertCapture = async (useScopedSchema: boolean) =>
      tableRef(admin, "identity_capture_embeddings", useScopedSchema).upsert(capturePayload, { onConflict: "capture_key" });

    let captureResult = await upsertCapture(true);
    if (captureResult.error && isSchemaProfileError(captureResult.error.message)) {
      captureResult = await upsertCapture(false);
    }
    const captureError = captureResult.error;
    if (captureError) {
      return Response.json({ ok: false, message: captureError.message }, { status: 500 });
    }

    const matchPayload = {
      match_key: matchKey,
      probe_capture_key: captureKey,
      candidate_image_key: candidateImageKey,
      entity_key: entityKey,
      source_key: sourceKey,
      similarity_score: similarityScore,
      positive_threshold: positiveThreshold,
      match_status: matchStatus,
      metadata: {
        origin: "identity_runtime_recognition_event",
        capture_view: captureView,
        model_name: asNonEmptyString(probe.model_name) || null,
        note: asNonEmptyString(match.note) || null,
      },
    };

    const upsertMatch = async (useScopedSchema: boolean) =>
      tableRef(admin, "identity_embedding_matches", useScopedSchema).upsert(matchPayload, { onConflict: "match_key" });

    let matchResult = await upsertMatch(true);
    if (matchResult.error && isSchemaProfileError(matchResult.error.message)) {
      matchResult = await upsertMatch(false);
    }
    const matchError = matchResult.error;
    if (matchError) {
      return Response.json({ ok: false, message: matchError.message }, { status: 500 });
    }

    const layers =
      layersRaw.length > 0
        ? layersRaw.slice(0, 32)
        : [
            {
              layer_name: "embedding_match",
              layer_result: similarityScore >= positiveThreshold ? "pass" : "review",
              layer_score: similarityScore,
              layer_payload: { inferred: true },
            },
          ];

    const layerRows = layers.map((layer, index) => ({
      layer_key: asNonEmptyString(layer.layer_key) || `${matchKey}:layer:${index + 1}`,
      match_key: matchKey,
      layer_name: asNonEmptyString(layer.layer_name) || `layer_${index + 1}`,
      layer_result: normalizeLayerResult(layer.layer_result),
      layer_score: clamp01(layer.layer_score, 0),
      layer_payload: typeof layer.layer_payload === "object" && layer.layer_payload ? layer.layer_payload : {},
    }));

    const upsertLayers = async (useScopedSchema: boolean) =>
      tableRef(admin, "identity_interpretation_layers", useScopedSchema).upsert(layerRows, { onConflict: "layer_key" });

    let layersResult = await upsertLayers(true);
    if (layersResult.error && isSchemaProfileError(layersResult.error.message)) {
      layersResult = await upsertLayers(false);
    }
    const layersError = layersResult.error;
    if (layersError) {
      return Response.json({ ok: false, message: layersError.message }, { status: 500 });
    }

    return Response.json(
      {
        ok: true,
        capture_key: captureKey,
        match_key: matchKey,
        candidate_image_key: candidateImageKey,
        match_status: matchStatus,
        similarity_score: similarityScore,
        positive_threshold: positiveThreshold,
        layers_registered: layerRows.length,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "identity_recognition_event_failed";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
