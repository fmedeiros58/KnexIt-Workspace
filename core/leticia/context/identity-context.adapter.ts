import type { IdentityRuntimeSharedContext } from "@/core/identity/shared-memory-context";
import type { IdentityRuntimeSnapshot } from "@/app/api/proactive-assistant/_shared";
import type { LeticiaIdentityContext } from "../types";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asIdentityScope(value: unknown) {
  const normalized = asText(value).toLowerCase();
  if (normalized === "permanent" || normalized === "temporary" || normalized === "test") {
    return normalized;
  }
  return null;
}

export function adaptIdentityContext(
  snapshot: IdentityRuntimeSnapshot | null,
  sharedContext: IdentityRuntimeSharedContext | null,
): LeticiaIdentityContext {
  const current = asRecord(snapshot?.current_identity);
  const currentMetadata = asRecord(current.metadata);
  const awareness = asRecord(snapshot?.awareness_state);
  const sharedRuntime = sharedContext?.snapshot?.runtime;
  const sharedCurrent = sharedContext?.snapshot?.trackedEntities?.[0];

  const entityKey = asText(current.entity_id) || sharedCurrent?.entityKey || null;
  const label = asText(current.label) || sharedCurrent?.label || null;
  const nominalName = asText(current.nominal_name) || sharedCurrent?.nominalName || null;
  const sourceId = asText(current.source_id) || sharedCurrent?.sourceKey || sharedRuntime?.selectedSourceId || null;
  const confidence = Math.max(
    asNumber(current.confidence, 0),
    sharedCurrent?.confidence || 0,
  );
  const identityPersonId =
    asText(current.identity_person_id) ||
    asText(current.person_id) ||
    asText(current.user_key) ||
    asText(currentMetadata.identity_person_id) ||
    asText(currentMetadata.person_id) ||
    asText(currentMetadata.personId) ||
    asText(currentMetadata.user_key) ||
    asText(currentMetadata.userKey) ||
    null;
  const identityScope =
    asIdentityScope(current.identity_scope) ||
    asIdentityScope(currentMetadata.identity_scope) ||
    null;

  return {
    entityKey,
    identityPersonId,
    identityScope,
    identityPersistent: identityScope === "permanent",
    displayName: nominalName || label || null,
    nominalName,
    label,
    sourceId,
    confidence,
    someoneInFrame: Boolean(awareness.someone_in_frame),
    identityConfirmed: Boolean(awareness.identity_confirmed),
    visualSource: asText(awareness.visual_source) || sharedRuntime?.selectedSourceId || null,
  };
}
