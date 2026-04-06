import { NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";

export const runtime = "nodejs";

const IMAGE_BUCKET = (process.env.IDENTITY_RUNTIME_IMAGE_BUCKET || "identity-runtime-images").trim();
const IDENTITY_SCHEMA = (process.env.AI_SYSTEM_ANM_IDENTITY_SQL_SCHEMA || "knex_identity_runtime").trim();
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
const DEFAULT_EMBEDDING_BASE_URL = "http://127.0.0.1:8001/v1";
const DEFAULT_TIMEOUT_MS = 45_000;

const CAPTURE_VIEW_ALLOWED = new Set(["main", "left", "front", "right", "gallery", "unknown"]);
const PROFILE_KIND_ALLOWED = new Set(["wanted", "passive"]);
const IDENTITY_SCOPE_ALLOWED = new Set(["permanent", "temporary", "test"]);

type IdentityScope = "permanent" | "temporary" | "test";

type PersonRow = {
  person_id: string;
  display_name: string;
  external_id?: string | null;
  profile_kind: "wanted" | "passive";
  identity_scope?: IdentityScope | null;
  is_archived?: boolean | null;
  expires_at?: string | null;
  search_active: boolean;
  preliminary_similarity_threshold: number;
  strong_similarity_threshold: number;
  min_consecutive_hits: number;
  min_window_ms: number;
  metadata?: Record<string, unknown> | null;
  updated_at: string;
};

type ProfileRow = {
  person_id: string;
  frontal_centroid?: unknown;
  left_centroid?: unknown;
  right_centroid?: unknown;
  consolidated_centroid?: unknown;
  front_samples?: number;
  left_samples?: number;
  right_samples?: number;
  retention_max_per_view?: number;
  retention_ttl_days?: number;
  updated_at?: string;
};

type ReferenceRow = {
  reference_id: number;
  person_id: string;
  image_key?: string | null;
  capture_view: string;
  quality_score?: number;
  created_at: string;
};

type ImageAssetRow = {
  image_key: string;
  file_name?: string | null;
  public_url?: string | null;
  created_at: string;
};

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function sanitizeText(value: unknown, maxLength: number) {
  const normalized = asNonEmptyString(value).replace(/\s+/g, " ");
  return normalized.slice(0, maxLength);
}

function asProfileKind(value: unknown) {
  const normalized = sanitizeText(value, 20).toLowerCase();
  if (PROFILE_KIND_ALLOWED.has(normalized)) return normalized as "wanted" | "passive";
  return "wanted";
}

function asIdentityScope(value: unknown, fallback: IdentityScope = "permanent") {
  const normalized = sanitizeText(value, 20).toLowerCase();
  if (IDENTITY_SCOPE_ALLOWED.has(normalized)) return normalized as IdentityScope;
  return fallback;
}

function clamp01(value: unknown, fallback: number) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" && !value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function parseIntBounded(value: unknown, fallback: number, min: number, max: number) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" && !value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = `${value ?? ""}`.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on", "sim"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "nao"].includes(normalized)) return false;
  return fallback;
}

function parseIsoTimestamp(value: unknown) {
  const normalized = sanitizeText(value, 64);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function defaultExpiresAtForScope(scope: IdentityScope) {
  if (scope === "permanent") return null;
  const now = Date.now();
  const days = scope === "test" ? 7 : 30;
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
}

function isFutureTimestamp(value: unknown) {
  const normalized = sanitizeText(value, 64);
  if (!normalized) return false;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) && parsed > Date.now();
}

function asCaptureView(value: unknown) {
  const normalized = sanitizeText(value, 24).toLowerCase();
  if (CAPTURE_VIEW_ALLOWED.has(normalized)) return normalized;
  return "unknown";
}

function inferCaptureViewFromName(fileName: string) {
  const name = sanitizeText(fileName, 180).toLowerCase();
  if (name.includes("left") || name.includes("esquerd")) return "left";
  if (name.includes("right") || name.includes("direit")) return "right";
  if (name.includes("front") || name.includes("frontal")) return "front";
  if (name.includes("main") || name.includes("principal")) return "main";
  return "gallery";
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

function isMissingRelationError(message: unknown) {
  const text = typeof message === "string" ? message : "";
  return /relation .* does not exist|could not find table|not found in schema cache|does not exist/i.test(text);
}

function tableRef(admin: ReturnType<typeof identitySupabaseAdmin>, table: string, useScopedSchema: boolean) {
  return useScopedSchema ? admin.schema(IDENTITY_SCHEMA).from(table) : admin.from(table);
}

function normalizeUrl(value: string) {
  return `${value || ""}`.trim().replace(/\/+$/, "");
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

function asVectorLiteral(values: number[] | null) {
  if (!values || !values.length) return null;
  return `[${values.map((item) => Number(item).toFixed(8)).join(",")}]`;
}

function parseVector(value: unknown) {
  if (Array.isArray(value)) {
    const parsed = value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
    return parsed.length ? parsed : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized.startsWith("[") || !normalized.endsWith("]")) return null;
    const items = normalized
      .slice(1, -1)
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
    return items.length ? items : null;
  }
  return null;
}

async function ensureImageBucket(admin: ReturnType<typeof identitySupabaseAdmin>) {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;
  const exists = buckets?.some((bucket) => bucket.id === IMAGE_BUCKET || bucket.name === IMAGE_BUCKET);
  if (exists) return;
  const { error: createError } = await admin.storage.createBucket(IMAGE_BUCKET, { public: true });
  if (createError && !/exists/i.test(createError.message)) throw createError;
}

async function requestEmbeddingForDataUrl(dataUrl: string) {
  const targets = resolveEmbeddingTargets();
  if (!targets.length) return null;

  const timeoutMs = parseTimeoutMs();
  const headers = {
    "content-type": "application/json",
    ...resolveAuthHeaders(),
  };

  for (const base of targets) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const target = base.endsWith("/v1") ? `${base}/face-embeddings` : `${base}/v1/face-embeddings`;
      const response = await fetch(target, {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: dataUrl,
          detect_face: true,
          output_dimension: 768,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);
      if (!response.ok) continue;
      const body = (await response.json().catch(() => ({}))) as {
        model?: string;
        data?: Array<{ embedding?: number[]; model?: string; confidence?: number }>;
      };
      const row = Array.isArray(body.data) ? body.data[0] : null;
      if (!Array.isArray(row?.embedding) || !row.embedding.length) continue;
      const embedding = row.embedding.map((item) => Number(item || 0)).filter((item) => Number.isFinite(item));
      if (!embedding.length) continue;
      return {
        embedding,
        modelName: sanitizeText(row?.model || body.model || "face-embedding", 120) || "face-embedding",
        confidence: clamp01(row?.confidence, 0.72),
      };
    } catch {
      // Try next endpoint.
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

async function runRpcWithSchemaFallback(
  admin: ReturnType<typeof identitySupabaseAdmin>,
  fnName: string,
  args: Record<string, unknown>,
) {
  const first = await admin.schema(IDENTITY_SCHEMA).rpc(fnName, args);
  if (first.error && isSchemaProfileError(first.error.message)) {
    return admin.rpc(fnName, args);
  }
  return first;
}

async function loadPeople(
  admin: ReturnType<typeof identitySupabaseAdmin>,
  profileKind: "wanted" | "passive",
  limit: number,
  options?: {
    identityScope?: IdentityScope | null;
    includeArchived?: boolean;
    includeExpired?: boolean;
  },
) {
  const loadPersons = async (useScopedSchema: boolean) =>
    tableRef(admin, "identity_persons", useScopedSchema)
      .select(
        "person_id, display_name, external_id, profile_kind, identity_scope, is_archived, expires_at, search_active, preliminary_similarity_threshold, strong_similarity_threshold, min_consecutive_hits, min_window_ms, metadata, updated_at",
      )
      .eq("profile_kind", profileKind)
      .order("updated_at", { ascending: false })
      .limit(Math.max(limit * 3, 200));

  let personsResult = await loadPersons(true);
  if (personsResult.error && isSchemaProfileError(personsResult.error.message)) {
    personsResult = await loadPersons(false);
  }
  if (personsResult.error) {
    if (isMissingRelationError(personsResult.error.message)) {
      return [];
    }
    throw new Error(personsResult.error.message);
  }

  let persons = (personsResult.data || []) as PersonRow[];
  if (options?.identityScope) {
    persons = persons.filter((row) => asIdentityScope(row.identity_scope, "permanent") === options.identityScope);
  }
  if (!options?.includeArchived) {
    persons = persons.filter((row) => !parseBoolean(row.is_archived, false));
  }
  if (!options?.includeExpired) {
    persons = persons.filter((row) => {
      const expiresAt = sanitizeText(row.expires_at, 64);
      return !expiresAt || isFutureTimestamp(expiresAt);
    });
  }
  persons = persons.slice(0, limit);
  if (!persons.length) return [];
  const personIds = persons.map((row) => row.person_id).filter(Boolean);

  const loadProfiles = async (useScopedSchema: boolean) =>
    tableRef(admin, "identity_person_profiles", useScopedSchema)
      .select(
        "person_id, frontal_centroid, left_centroid, right_centroid, consolidated_centroid, front_samples, left_samples, right_samples, retention_max_per_view, retention_ttl_days, updated_at",
      )
      .in("person_id", personIds);

  let profilesResult = await loadProfiles(true);
  if (profilesResult.error && isSchemaProfileError(profilesResult.error.message)) {
    profilesResult = await loadProfiles(false);
  }
  let profilesRows: ProfileRow[] = [];
  if (profilesResult.error) {
    if (isMissingRelationError(profilesResult.error.message)) {
      profilesRows = [];
    } else {
      throw new Error(profilesResult.error.message);
    }
  } else {
    profilesRows = (profilesResult.data || []) as ProfileRow[];
  }

  const loadRefs = async (useScopedSchema: boolean) =>
    tableRef(admin, "identity_person_reference_images", useScopedSchema)
      .select("reference_id, person_id, image_key, capture_view, quality_score, created_at")
      .in("person_id", personIds)
      .order("created_at", { ascending: false })
      .limit(400);

  let refsResult = await loadRefs(true);
  if (refsResult.error && isSchemaProfileError(refsResult.error.message)) {
    refsResult = await loadRefs(false);
  }
  let refs: ReferenceRow[] = [];
  if (refsResult.error) {
    if (isMissingRelationError(refsResult.error.message)) {
      refs = [];
    } else {
      throw new Error(refsResult.error.message);
    }
  } else {
    refs = (refsResult.data || []) as ReferenceRow[];
  }
  const imageKeys = Array.from(new Set(refs.map((row) => sanitizeText(row.image_key, 120)).filter(Boolean)));

  let assets: ImageAssetRow[] = [];
  if (imageKeys.length > 0) {
    const loadAssets = async (useScopedSchema: boolean) =>
      tableRef(admin, "identity_image_assets", useScopedSchema)
        .select("image_key, file_name, public_url, created_at")
        .in("image_key", imageKeys);

    let assetsResult = await loadAssets(true);
    if (assetsResult.error && isSchemaProfileError(assetsResult.error.message)) {
      assetsResult = await loadAssets(false);
    }
    if (assetsResult.error) {
      if (isMissingRelationError(assetsResult.error.message)) {
        assets = [];
      } else {
        throw new Error(assetsResult.error.message);
      }
    } else {
      assets = (assetsResult.data || []) as ImageAssetRow[];
    }
  }

  const profileByPerson = new Map<string, ProfileRow>();
  for (const row of profilesRows) {
    profileByPerson.set(row.person_id, row);
  }
  const refsByPerson = new Map<string, ReferenceRow[]>();
  for (const row of refs) {
    if (!refsByPerson.has(row.person_id)) refsByPerson.set(row.person_id, []);
    refsByPerson.get(row.person_id)?.push(row);
  }
  const assetsByKey = new Map<string, ImageAssetRow>();
  for (const row of assets) {
    assetsByKey.set(row.image_key, row);
  }

  return persons.map((person) => {
    const profile = profileByPerson.get(person.person_id);
    const rows = (refsByPerson.get(person.person_id) || []).slice().sort((a, b) => {
      const qa = Number(a.quality_score || 0);
      const qb = Number(b.quality_score || 0);
      if (qb !== qa) return qb - qa;
      return `${b.created_at || ""}`.localeCompare(`${a.created_at || ""}`);
    });
    const first = rows[0] || null;
    const firstAsset = first?.image_key ? assetsByKey.get(first.image_key) : null;
    const referenceImages = rows.slice(0, 32).map((row) => {
      const asset = row.image_key ? assetsByKey.get(row.image_key) : null;
      return {
        image_key: row.image_key || null,
        capture_view: row.capture_view || "unknown",
        quality_score: Number(row.quality_score || 0),
        created_at: row.created_at,
        file_name: asset?.file_name || null,
        public_url: asset?.public_url || null,
      };
    });
    const vectorsByView: Record<string, number[][]> = {};
    const front = parseVector(profile?.frontal_centroid);
    const left = parseVector(profile?.left_centroid);
    const right = parseVector(profile?.right_centroid);
    const consolidated = parseVector(profile?.consolidated_centroid);
    if (front) vectorsByView.front = [front];
    if (left) vectorsByView.left = [left];
    if (right) vectorsByView.right = [right];
    if (!vectorsByView.front && !vectorsByView.left && !vectorsByView.right && consolidated) {
      vectorsByView.unknown = [consolidated];
    }

    return {
      person_id: person.person_id,
      display_name: person.display_name,
      external_id: person.external_id || null,
      profile_kind: person.profile_kind,
      identity_scope: asIdentityScope(person.identity_scope, "permanent"),
      is_archived: parseBoolean(person.is_archived, false),
      expires_at: sanitizeText(person.expires_at, 64) || null,
      search_active: Boolean(person.search_active),
      preliminary_similarity_threshold: Number(person.preliminary_similarity_threshold || 0.72),
      strong_similarity_threshold: Number(person.strong_similarity_threshold || 0.82),
      min_consecutive_hits: Number(person.min_consecutive_hits || 3),
      min_window_ms: Number(person.min_window_ms || 2400),
      metadata: person.metadata || {},
      profile: {
        front_samples: Number(profile?.front_samples || 0),
        left_samples: Number(profile?.left_samples || 0),
        right_samples: Number(profile?.right_samples || 0),
        retention_max_per_view: Number(profile?.retention_max_per_view || 12),
        retention_ttl_days: Number(profile?.retention_ttl_days || 180),
        consolidated_centroid: consolidated,
        updated_at: profile?.updated_at || null,
      },
      profile_vectors_by_view: vectorsByView,
      preview_image_key: first?.image_key || null,
      preview_image_name: firstAsset?.file_name || null,
      preview_image_url: firstAsset?.public_url || null,
      reference_images: referenceImages,
      updated_at: person.updated_at,
    };
  });
}

export async function GET(req: NextRequest) {
  const profileKind = asProfileKind(req.nextUrl.searchParams.get("profile_kind"));
  const identityScopeParam = sanitizeText(req.nextUrl.searchParams.get("identity_scope"), 20);
  const identityScope = identityScopeParam ? asIdentityScope(identityScopeParam) : null;
  const includeArchived = parseBoolean(req.nextUrl.searchParams.get("include_archived"), false);
  const includeExpired = parseBoolean(req.nextUrl.searchParams.get("include_expired"), false);
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.round(limitRaw))) : 50;
  try {
    const admin = identitySupabaseAdmin();
    const people = await loadPeople(admin, profileKind, limit, {
      identityScope,
      includeArchived,
      includeExpired,
    });
    return Response.json(
      {
        ok: true,
        profile_kind: profileKind,
        identity_scope: identityScope,
        include_archived: includeArchived,
        include_expired: includeExpired,
        people,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "wanted_people_query_failed";
    return Response.json(
      {
        ok: true,
        profile_kind: profileKind,
        people: [],
        degraded: true,
        message,
      },
      { status: 200 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = identitySupabaseAdmin();
    await ensureImageBucket(admin);

    const formData = await req.formData();
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (!(value instanceof File)) continue;
      if (!value.type.startsWith("image/")) continue;
      if (key === "file" || key === "files" || key.startsWith("file")) {
        files.push(value);
      }
    }
    if (!files.length) {
      return Response.json({ ok: false, message: "Nenhuma imagem valida recebida." }, { status: 400 });
    }

    const personId = sanitizeText(formData.get("person_id"), 120) || `wanted-${randomUUID().slice(0, 12)}`;
    const displayName = sanitizeText(formData.get("display_name"), 220) || personId;
    const profileKind = asProfileKind(formData.get("profile_kind"));
    const identityScope = asIdentityScope(formData.get("identity_scope"), "permanent");
    const explicitExpiresAt = parseIsoTimestamp(formData.get("expires_at"));
    const expiresAt = identityScope === "permanent" ? null : explicitExpiresAt || defaultExpiresAtForScope(identityScope);
    const searchActive = parseBoolean(formData.get("search_active"), profileKind === "wanted");
    const externalId = sanitizeText(formData.get("external_id"), 120) || null;
    const sourceKey = sanitizeText(formData.get("source_key"), 120) || "wanted-registry";
    const explicitCaptureView = asCaptureView(formData.get("capture_view"));
    const retentionMaxPerView = parseIntBounded(formData.get("retention_max_per_view"), 12, 1, 200);
    const retentionTtlDays = parseIntBounded(formData.get("retention_ttl_days"), 180, 1, 3650);
    const preliminaryThreshold = clamp01(formData.get("preliminary_similarity_threshold"), 0.72);
    const strongThreshold = clamp01(formData.get("strong_similarity_threshold"), 0.82);
    const minConsecutiveHits = parseIntBounded(formData.get("min_consecutive_hits"), 3, 1, 120);
    const minWindowMs = parseIntBounded(formData.get("min_window_ms"), 2400, 200, 120000);

    const upsertPerson = async (useScopedSchema: boolean) =>
      tableRef(admin, "identity_persons", useScopedSchema).upsert(
        {
          person_id: personId,
          display_name: displayName,
          external_id: externalId,
          profile_kind: profileKind,
          identity_scope: identityScope,
          is_archived: false,
          expires_at: expiresAt,
          search_active: searchActive,
          preliminary_similarity_threshold: preliminaryThreshold,
          strong_similarity_threshold: strongThreshold,
          min_consecutive_hits: minConsecutiveHits,
          min_window_ms: minWindowMs,
          metadata: {
            origin: "wanted_ingest_api",
            identity_scope: identityScope,
          },
        },
        { onConflict: "person_id" },
      );

    let personResult = await upsertPerson(true);
    if (personResult.error && isSchemaProfileError(personResult.error.message)) {
      personResult = await upsertPerson(false);
    }
    if (personResult.error) {
      return Response.json({ ok: false, message: personResult.error.message }, { status: 500 });
    }

    const upsertProfile = async (useScopedSchema: boolean) =>
      tableRef(admin, "identity_person_profiles", useScopedSchema).upsert(
        {
          person_id: personId,
          retention_max_per_view: retentionMaxPerView,
          retention_ttl_days: retentionTtlDays,
        },
        { onConflict: "person_id" },
      );

    let profileResult = await upsertProfile(true);
    if (profileResult.error && isSchemaProfileError(profileResult.error.message)) {
      profileResult = await upsertProfile(false);
    }
    if (profileResult.error) {
      return Response.json({ ok: false, message: profileResult.error.message }, { status: 500 });
    }

    const today = new Date();
    const yyyy = String(today.getUTCFullYear());
    const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const personPart = personId.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 64) || "wanted";

    let ingested = 0;
    let embeddingReady = 0;
    const errors: string[] = [];

    for (const file of files.slice(0, 24)) {
      if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
        errors.push(`${file.name || "arquivo"}: tamanho invalido`);
        continue;
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const digest = createHash("sha256").update(bytes).digest("hex");
      const imageKey = randomUUID();
      const extension = extensionFromMime(file.type || "image/jpeg");
      const objectPath = `runtime/wanted/${personPart}/${yyyy}/${mm}/${imageKey}.${extension}`;
      const captureView = explicitCaptureView === "unknown" ? inferCaptureViewFromName(file.name || "") : explicitCaptureView;

      const { error: uploadError } = await admin.storage.from(IMAGE_BUCKET).upload(objectPath, bytes, {
        upsert: false,
        contentType: file.type || "image/jpeg",
        cacheControl: "3600",
      });
      if (uploadError) {
        errors.push(`${file.name || "arquivo"}: ${uploadError.message}`);
        continue;
      }

      const publicUrl = admin.storage.from(IMAGE_BUCKET).getPublicUrl(objectPath).data.publicUrl;
      const insertAsset = async (useScopedSchema: boolean) =>
        tableRef(admin, "identity_image_assets", useScopedSchema).insert({
          image_key: imageKey,
          entity_key: personId,
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
            origin: "wanted_registry_ingest",
            person_id: personId,
            profile_kind: profileKind,
          },
        });

      let assetResult = await insertAsset(true);
      if (assetResult.error && isSchemaProfileError(assetResult.error.message)) {
        assetResult = await insertAsset(false);
      }
      if (assetResult.error) {
        await admin.storage.from(IMAGE_BUCKET).remove([objectPath]).catch(() => null);
        errors.push(`${file.name || "arquivo"}: ${assetResult.error.message}`);
        continue;
      }

      const dataUrl = `data:${file.type || "image/jpeg"};base64,${bytes.toString("base64")}`;
      const embeddingPayload = await requestEmbeddingForDataUrl(dataUrl);
      const vectorLiteral = asVectorLiteral(embeddingPayload?.embedding || null);
      const modelName = embeddingPayload?.modelName || null;
      const qualityScore = clamp01(embeddingPayload?.confidence, 0.72);

      if (vectorLiteral) {
        const insertImageEmbedding = async (useScopedSchema: boolean) =>
          tableRef(admin, "identity_image_embeddings", useScopedSchema).insert({
            image_key: imageKey,
            embedding: vectorLiteral,
            model_name: modelName,
            embedding_source: "wanted_registry_ingest",
            confidence: qualityScore,
            metadata: {
              person_id: personId,
              profile_kind: profileKind,
            },
          });
        let imageEmbeddingResult = await insertImageEmbedding(true);
        if (imageEmbeddingResult.error && isSchemaProfileError(imageEmbeddingResult.error.message)) {
          imageEmbeddingResult = await insertImageEmbedding(false);
        }
        if (!imageEmbeddingResult.error) {
          embeddingReady += 1;
        }
      }

      const insertReference = async (useScopedSchema: boolean) =>
        tableRef(admin, "identity_person_reference_images", useScopedSchema).insert({
          person_id: personId,
          image_key: imageKey,
          capture_view: captureView,
          quality_score: qualityScore,
          embedding: vectorLiteral,
          model_name: modelName,
          metadata: {
            origin: "wanted_registry_ingest",
            source_key: sourceKey,
            file_name: file.name || null,
          },
        });

      let referenceResult = await insertReference(true);
      if (referenceResult.error && isSchemaProfileError(referenceResult.error.message)) {
        referenceResult = await insertReference(false);
      }
      if (referenceResult.error) {
        errors.push(`${file.name || "arquivo"}: ${referenceResult.error.message}`);
        continue;
      }

      ingested += 1;
    }

    await runRpcWithSchemaFallback(admin, "refresh_identity_person_profile", { p_person_id: personId }).catch(() => null);
    await runRpcWithSchemaFallback(admin, "apply_person_reference_retention", { p_person_id: personId }).catch(() => null);

    const people = await loadPeople(admin, profileKind, 200, { includeExpired: true, includeArchived: true });
    const person = people.find((item) => item.person_id === personId) || null;

    return Response.json(
      {
        ok: true,
        person_id: personId,
        ingested_images: ingested,
        embeddings_ready: embeddingReady,
        skipped_images: Math.max(0, files.length - ingested),
        errors,
        person,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "wanted_people_ingest_failed";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = identitySupabaseAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const personId = sanitizeText(body.person_id, 120);
    if (!personId) {
      return Response.json({ ok: false, message: "person_id e obrigatorio." }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (body.display_name !== undefined) patch.display_name = sanitizeText(body.display_name, 220) || personId;
    if (body.external_id !== undefined) patch.external_id = sanitizeText(body.external_id, 120) || null;
    if (body.profile_kind !== undefined) patch.profile_kind = asProfileKind(body.profile_kind);
    const nextIdentityScope =
      body.identity_scope !== undefined ? asIdentityScope(body.identity_scope, "permanent") : undefined;
    if (nextIdentityScope !== undefined) {
      patch.identity_scope = nextIdentityScope;
      if (nextIdentityScope === "permanent") {
        patch.expires_at = null;
      }
    }
    if (body.expires_at !== undefined) {
      const explicitExpiresAt = parseIsoTimestamp(body.expires_at);
      patch.expires_at = nextIdentityScope === "permanent" ? null : explicitExpiresAt;
    }
    if (body.is_archived !== undefined) {
      const archived = parseBoolean(body.is_archived, false);
      patch.is_archived = archived;
      if (archived) patch.search_active = false;
    }
    if (body.search_active !== undefined) patch.search_active = parseBoolean(body.search_active, true);
    if (body.preliminary_similarity_threshold !== undefined) {
      patch.preliminary_similarity_threshold = clamp01(body.preliminary_similarity_threshold, 0.72);
    }
    if (body.strong_similarity_threshold !== undefined) {
      patch.strong_similarity_threshold = clamp01(body.strong_similarity_threshold, 0.82);
    }
    if (body.min_consecutive_hits !== undefined) {
      patch.min_consecutive_hits = parseIntBounded(body.min_consecutive_hits, 3, 1, 120);
    }
    if (body.min_window_ms !== undefined) {
      patch.min_window_ms = parseIntBounded(body.min_window_ms, 2400, 200, 120000);
    }
    patch.updated_at = new Date().toISOString();

    const updatePerson = async (useScopedSchema: boolean) =>
      tableRef(admin, "identity_persons", useScopedSchema).update(patch).eq("person_id", personId);

    let updateResult = await updatePerson(true);
    if (updateResult.error && isSchemaProfileError(updateResult.error.message)) {
      updateResult = await updatePerson(false);
    }
    if (updateResult.error) {
      return Response.json({ ok: false, message: updateResult.error.message }, { status: 500 });
    }

    const retentionPatch: Record<string, unknown> = {};
    if (body.retention_max_per_view !== undefined) {
      retentionPatch.retention_max_per_view = parseIntBounded(body.retention_max_per_view, 12, 1, 200);
    }
    if (body.retention_ttl_days !== undefined) {
      retentionPatch.retention_ttl_days = parseIntBounded(body.retention_ttl_days, 180, 1, 3650);
    }
    if (Object.keys(retentionPatch).length > 0) {
      retentionPatch.person_id = personId;
      const upsertProfile = async (useScopedSchema: boolean) =>
        tableRef(admin, "identity_person_profiles", useScopedSchema).upsert(retentionPatch, { onConflict: "person_id" });
      let profileResult = await upsertProfile(true);
      if (profileResult.error && isSchemaProfileError(profileResult.error.message)) {
        profileResult = await upsertProfile(false);
      }
      if (profileResult.error) {
        return Response.json({ ok: false, message: profileResult.error.message }, { status: 500 });
      }
      await runRpcWithSchemaFallback(admin, "apply_person_reference_retention", { p_person_id: personId }).catch(() => null);
    }

    const profileKind = asProfileKind(body.profile_kind || "wanted");
    const people = await loadPeople(admin, profileKind, 200, { includeArchived: true, includeExpired: true });
    const person = people.find((item) => item.person_id === personId) || null;
    return Response.json({ ok: true, person }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "wanted_people_update_failed";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}


