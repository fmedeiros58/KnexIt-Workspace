import { NextRequest } from "next/server";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";

export const runtime = "nodejs";

const IDENTITY_SCHEMA = (process.env.AI_SYSTEM_ANM_IDENTITY_SQL_SCHEMA || "knex_identity_runtime").trim();
const RUNTIME_TABLE = "identity_runtime_config";
const SUPERADMIN_RUNTIME_KEY = "superadmin_restrictions";
const DEFAULT_MAX_PROMPT_CHARS = 4_800;
const RUNTIME_STATES = new Set([
  "disabled",
  "enabled_idle",
  "monitoring",
  "tracking",
  "validating",
  "identified",
  "conflict",
  "paused",
  "degraded",
]);

type RuntimeConfigRow = {
  id?: number;
  runtime_key: string;
  auto_start_enabled: boolean;
  runtime_enabled: boolean;
  runtime_paused: boolean;
  runtime_state: string;
  selected_source_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

type RuntimeRestrictions = {
  allow_shared_identity_memory: boolean;
  max_prompt_chars: number;
  note: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function sanitizeText(value: unknown, maxLength: number) {
  const normalized = asNonEmptyString(value).replace(/\s+/g, " ");
  return normalized.slice(0, maxLength);
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = `${value ?? ""}`.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on", "sim"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "nao"].includes(normalized)) return false;
  return fallback;
}

function parseBoundedInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeRuntimeState(value: unknown) {
  const normalized = sanitizeText(value, 40).toLowerCase();
  if (RUNTIME_STATES.has(normalized)) return normalized;
  return "disabled";
}

function isSchemaProfileError(message: unknown) {
  const text = typeof message === "string" ? message : "";
  return /schema must be one of/i.test(text);
}

function tableRef(admin: ReturnType<typeof identitySupabaseAdmin>, useScopedSchema: boolean) {
  return useScopedSchema ? admin.schema(IDENTITY_SCHEMA).from(RUNTIME_TABLE) : admin.from(RUNTIME_TABLE);
}

function resolveDefaultMaxPromptChars() {
  return parseBoundedInt(process.env.IDENTITY_SHARED_MEMORY_MAX_PROMPT_CHARS, DEFAULT_MAX_PROMPT_CHARS, 600, 24_000);
}

function extractRestrictionsFromMetadata(metadataInput: unknown): RuntimeRestrictions {
  const metadata = asObject(metadataInput);
  const superadmin = asObject(metadata.superadmin);
  const scopedRestrictions = asObject(superadmin.restrictions);
  const legacyRestrictions = asObject(metadata.restrictions);
  const allowRaw =
    scopedRestrictions.allow_shared_identity_memory ??
    scopedRestrictions.allowSharedIdentityMemory ??
    legacyRestrictions.allow_shared_identity_memory ??
    legacyRestrictions.allowSharedIdentityMemory;
  const maxPromptRaw =
    scopedRestrictions.max_prompt_chars ??
    scopedRestrictions.maxPromptChars ??
    legacyRestrictions.max_prompt_chars ??
    legacyRestrictions.maxPromptChars;
  const noteRaw = scopedRestrictions.note ?? legacyRestrictions.note;
  const updatedByRaw = scopedRestrictions.updated_by ?? scopedRestrictions.updatedBy ?? legacyRestrictions.updated_by;
  const updatedAtRaw = scopedRestrictions.updated_at ?? scopedRestrictions.updatedAt ?? legacyRestrictions.updated_at;

  return {
    allow_shared_identity_memory: parseBoolean(allowRaw, true),
    max_prompt_chars: parseBoundedInt(maxPromptRaw, resolveDefaultMaxPromptChars(), 600, 24_000),
    note: sanitizeText(noteRaw, 320) || null,
    updated_by: sanitizeText(updatedByRaw, 140) || null,
    updated_at: sanitizeText(updatedAtRaw, 60) || null,
  };
}

function mergeRestrictionsMetadata(
  existingMetadata: unknown,
  restrictions: RuntimeRestrictions,
  payloadMeta: { updated_by: string | null },
) {
  const metadata = asObject(existingMetadata);
  const superadmin = asObject(metadata.superadmin);
  const scopedRestrictions = asObject(superadmin.restrictions);
  const legacyRestrictions = asObject(metadata.restrictions);
  const updatedAt = new Date().toISOString();
  const nextRestrictions = {
    ...legacyRestrictions,
    ...scopedRestrictions,
    allow_shared_identity_memory: restrictions.allow_shared_identity_memory,
    max_prompt_chars: restrictions.max_prompt_chars,
    note: restrictions.note,
    updated_by: payloadMeta.updated_by,
    updated_at: updatedAt,
  };
  return {
    ...metadata,
    restrictions: nextRestrictions,
    superadmin: {
      ...superadmin,
      managed_by: payloadMeta.updated_by,
      managed_at: updatedAt,
      restrictions: nextRestrictions,
    },
  };
}

function resolveSuperadminKeyFromRequest(req: NextRequest) {
  const fromHeader = sanitizeText(req.headers.get("x-superadmin-key"), 512);
  if (fromHeader) return fromHeader;
  const authorization = sanitizeText(req.headers.get("authorization"), 1024);
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return sanitizeText(authorization.slice(7), 512);
  }
  return sanitizeText(req.nextUrl.searchParams.get("superadmin_key"), 512);
}

function enforceSuperadminAccess(req: NextRequest) {
  const requiredKey = sanitizeText(process.env.IDENTITY_SUPERADMIN_KEY || process.env.SUPERADMIN_API_KEY, 512);
  if (!requiredKey) return null;
  const provided = resolveSuperadminKeyFromRequest(req);
  if (provided && provided === requiredKey) return null;
  return Response.json(
    {
      ok: false,
      message: "superadmin_key_invalid",
      auth_required: true,
    },
    { status: 401 },
  );
}

async function loadPolicyRow(admin: ReturnType<typeof identitySupabaseAdmin>) {
  const run = async (useScopedSchema: boolean) =>
    tableRef(admin, useScopedSchema)
      .select("id, runtime_key, auto_start_enabled, runtime_enabled, runtime_paused, runtime_state, selected_source_id, metadata, created_at, updated_at")
      .eq("runtime_key", SUPERADMIN_RUNTIME_KEY)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  let response = await run(true);
  if (response.error && isSchemaProfileError(response.error.message)) {
    response = await run(false);
  }
  if (response.error) {
    throw new Error(response.error.message);
  }
  return (response.data || null) as RuntimeConfigRow | null;
}

export async function GET(req: NextRequest) {
  const denied = enforceSuperadminAccess(req);
  if (denied) return denied;

  try {
    const admin = identitySupabaseAdmin();
    const row = await loadPolicyRow(admin);
    const restrictions = extractRestrictionsFromMetadata(row?.metadata);
    return Response.json(
      {
        ok: true,
        runtime_key: SUPERADMIN_RUNTIME_KEY,
        auth_required: Boolean(sanitizeText(process.env.IDENTITY_SUPERADMIN_KEY || process.env.SUPERADMIN_API_KEY, 512)),
        restrictions,
        row: row
          ? {
              runtime_enabled: row.runtime_enabled,
              runtime_paused: row.runtime_paused,
              runtime_state: row.runtime_state,
              selected_source_id: row.selected_source_id || null,
              updated_at: row.updated_at || null,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "superadmin_restrictions_read_failed";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = enforceSuperadminAccess(req);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const admin = identitySupabaseAdmin();
    const currentRow = await loadPolicyRow(admin);
    const currentRestrictions = extractRestrictionsFromMetadata(currentRow?.metadata);

    const allowSharedIdentityMemory = parseBoolean(
      body.allow_shared_identity_memory ?? body.allowSharedIdentityMemory,
      currentRestrictions.allow_shared_identity_memory,
    );
    const maxPromptChars = parseBoundedInt(
      body.max_prompt_chars ?? body.maxPromptChars,
      currentRestrictions.max_prompt_chars,
      600,
      24_000,
    );
    const note = sanitizeText(body.note, 320) || null;
    const updatedBy = sanitizeText(body.updated_by ?? body.updatedBy, 140) || null;

    const restrictions: RuntimeRestrictions = {
      allow_shared_identity_memory: allowSharedIdentityMemory,
      max_prompt_chars: maxPromptChars,
      note,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    };

    const payload: RuntimeConfigRow = {
      runtime_key: SUPERADMIN_RUNTIME_KEY,
      auto_start_enabled: currentRow?.auto_start_enabled ?? false,
      runtime_enabled: currentRow?.runtime_enabled ?? false,
      runtime_paused: currentRow?.runtime_paused ?? false,
      runtime_state: normalizeRuntimeState(currentRow?.runtime_state),
      selected_source_id: sanitizeText(currentRow?.selected_source_id, 120) || null,
      metadata: mergeRestrictionsMetadata(currentRow?.metadata, restrictions, { updated_by: updatedBy }),
    };

    const upsert = async (useScopedSchema: boolean) =>
      tableRef(admin, useScopedSchema)
        .upsert(payload, { onConflict: "runtime_key" })
        .select(
          "id, runtime_key, auto_start_enabled, runtime_enabled, runtime_paused, runtime_state, selected_source_id, metadata, created_at, updated_at",
        )
        .single();

    let response = await upsert(true);
    if (response.error && isSchemaProfileError(response.error.message)) {
      response = await upsert(false);
    }
    if (response.error) {
      return Response.json({ ok: false, message: response.error.message }, { status: 500 });
    }

    const persisted = (response.data || payload) as RuntimeConfigRow;
    return Response.json(
      {
        ok: true,
        runtime_key: SUPERADMIN_RUNTIME_KEY,
        restrictions: extractRestrictionsFromMetadata(persisted.metadata),
        row: {
          runtime_enabled: persisted.runtime_enabled,
          runtime_paused: persisted.runtime_paused,
          runtime_state: persisted.runtime_state,
          selected_source_id: persisted.selected_source_id || null,
          updated_at: persisted.updated_at || null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "superadmin_restrictions_write_failed";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
