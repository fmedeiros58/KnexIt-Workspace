import { NextRequest } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";

export const runtime = "nodejs";

const IMAGE_BUCKET = (process.env.IDENTITY_RUNTIME_IMAGE_BUCKET || "identity-runtime-images").trim();
const IDENTITY_SCHEMA = (process.env.AI_SYSTEM_ANM_IDENTITY_SQL_SCHEMA || "knex_identity_runtime").trim();
const IMAGE_TABLE = "identity_image_assets";
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;

const CAPTURE_VIEW_ALLOWED = new Set(["main", "left", "front", "right", "gallery", "unknown"]);

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function sanitizeText(value: unknown, maxLength: number) {
  const normalized = asNonEmptyString(value).replace(/\s+/g, " ");
  return normalized.slice(0, maxLength);
}

function asCaptureView(value: unknown) {
  const normalized = sanitizeText(value, 24).toLowerCase();
  if (CAPTURE_VIEW_ALLOWED.has(normalized)) return normalized;
  return "unknown";
}

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "img";
}

function isSchemaProfileError(message: unknown) {
  const text = typeof message === "string" ? message : "";
  return /schema must be one of/i.test(text);
}

function imageTableRef(admin: ReturnType<typeof identitySupabaseAdmin>, useScopedSchema: boolean) {
  return useScopedSchema ? admin.schema(IDENTITY_SCHEMA).from(IMAGE_TABLE) : admin.from(IMAGE_TABLE);
}

async function ensureImageBucket(admin: ReturnType<typeof identitySupabaseAdmin>) {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;
  const exists = buckets?.some((bucket) => bucket.id === IMAGE_BUCKET || bucket.name === IMAGE_BUCKET);
  if (exists) return;
  const { error: createError } = await admin.storage.createBucket(IMAGE_BUCKET, { public: true });
  if (createError && !/exists/i.test(createError.message)) throw createError;
}

export async function GET(req: NextRequest) {
  try {
    const admin = identitySupabaseAdmin();
    const entityKey = sanitizeText(req.nextUrl.searchParams.get("entity_key"), 120);
    const sourceKey = sanitizeText(req.nextUrl.searchParams.get("source_key"), 120);
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 8);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.round(limitRaw))) : 8;

    const runQuery = async (useScopedSchema: boolean) => {
      let query = imageTableRef(admin, useScopedSchema)
        .select(
          "image_key, entity_key, source_key, capture_view, file_name, mime_type, size_bytes, storage_bucket, storage_path, public_url, metadata, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit);
      if (entityKey) query = query.eq("entity_key", entityKey);
      if (sourceKey) query = query.eq("source_key", sourceKey);
      return query;
    };

    let { data, error } = await runQuery(true);
    if (error && isSchemaProfileError(error.message)) {
      const fallback = await runQuery(false);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) {
      return Response.json({ ok: false, message: error.message }, { status: 500 });
    }
    return Response.json({ ok: true, images: data || [] }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "identity_image_query_failed";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = identitySupabaseAdmin();
    await ensureImageBucket(admin);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ ok: false, message: "Arquivo invalido." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return Response.json({ ok: false, message: "Somente imagens sao permitidas." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
      return Response.json(
        { ok: false, message: `Tamanho invalido. Limite atual: ${Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))}MB.` },
        { status: 400 },
      );
    }

    const entityKey = sanitizeText(formData.get("entity_key") ?? formData.get("entity_id"), 120) || null;
    const sourceKey = sanitizeText(formData.get("source_key") ?? formData.get("source_id"), 120) || null;
    const captureView = asCaptureView(formData.get("capture_view"));
    const note = sanitizeText(formData.get("note"), 280) || null;

    const bytes = Buffer.from(await file.arrayBuffer());
    const digest = createHash("sha256").update(bytes).digest("hex");
    const imageKey = randomUUID();
    const extension = extensionFromMime(file.type || "image/jpeg");
    const today = new Date();
    const yyyy = String(today.getUTCFullYear());
    const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const entityPart = (entityKey || "unassigned").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 64);
    const objectPath = `runtime/${entityPart}/${yyyy}/${mm}/${imageKey}.${extension}`;

    const { error: uploadError } = await admin.storage.from(IMAGE_BUCKET).upload(objectPath, bytes, {
      upsert: false,
      contentType: file.type || "image/jpeg",
      cacheControl: "3600",
    });
    if (uploadError) {
      return Response.json({ ok: false, message: uploadError.message }, { status: 500 });
    }

    const publicUrl = admin.storage.from(IMAGE_BUCKET).getPublicUrl(objectPath).data.publicUrl;
    const insertPayload = {
      image_key: imageKey,
      entity_key: entityKey,
      source_key: sourceKey,
      capture_view: captureView,
      file_name: sanitizeText(file.name, 180) || `${imageKey}.${extension}`,
      mime_type: sanitizeText(file.type, 120) || "image/jpeg",
      size_bytes: file.size,
      image_hash_sha256: digest,
      storage_bucket: IMAGE_BUCKET,
      storage_path: objectPath,
      public_url: publicUrl || null,
      metadata: {
        origin: "identity_runtime_awareness_upload",
        note,
      },
    };

    const runInsert = async (useScopedSchema: boolean) =>
      imageTableRef(admin, useScopedSchema).insert(insertPayload).select("*").single();

    let { data, error } = await runInsert(true);
    if (error && isSchemaProfileError(error.message)) {
      const fallback = await runInsert(false);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      await admin.storage.from(IMAGE_BUCKET).remove([objectPath]).catch(() => null);
      return Response.json({ ok: false, message: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, image: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "identity_image_ingest_failed";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
