import type { IdentityRuntimeSnapshot } from "@/app/api/proactive-assistant/_shared";
import type { LeticiaVisualContext } from "../types";

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

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = asText(value).toLowerCase();
  if (["1", "true", "yes", "on", "sim"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "nao"].includes(normalized)) return false;
  return fallback;
}

export function adaptVisualContext(snapshot: IdentityRuntimeSnapshot | null): LeticiaVisualContext {
  const visual = asRecord(snapshot?.visual_context);
  const events = Array.isArray(snapshot?.recent_scene_events) ? snapshot?.recent_scene_events : [];

  return {
    sceneSummary: asText(visual.scene_summary) || null,
    presenceDurationMs: Math.max(0, Math.round(asNumber(visual.presence_duration_ms, 0))),
    currentInterlocutorDurationMs: Math.max(0, Math.round(asNumber(visual.current_interlocutor_duration_ms, 0))),
    currentInterlocutorStable: asBoolean(visual.current_interlocutor_stable, false),
    currentInterlocutorPersistenceLevel: Math.max(0, Math.round(asNumber(visual.current_interlocutor_persistence_level, 0))),
    currentInterlocutorEntityId: asText(visual.current_interlocutor_entity_id) || null,
    currentInterlocutorLabel: asText(visual.current_interlocutor_label) || null,
    sourceId: asText(visual.source_id) || null,
    interlocutorSwitched: asBoolean(visual.interlocutor_switched, false),
    trackedEntitiesCount: Math.max(0, Math.round(asNumber(visual.tracked_entities_count, 0))),
    recentSceneEvents: events
      .filter((item) => item && typeof item === "object")
      .slice(0, 6)
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          eventType: asText(row.event_type) || "scene_event",
          summary: asText(row.summary) || "",
          at: asText(row.at) || null,
          entityKey: asText(row.entity_id) || null,
          label: asText(row.label) || null,
          sourceId: asText(row.source_id) || null,
          confidence: Math.max(0, Math.min(1, asNumber(row.confidence, 0))),
        };
      }),
  };
}
