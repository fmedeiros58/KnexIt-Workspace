import { NextRequest } from "next/server";

import { readIdentityRuntimeStatus, resolveRequestOrigin, type IdentityRuntimeSnapshot } from "../_shared";

export const runtime = "nodejs";

const POLL_INTERVAL_MS = 1_200;
const PING_INTERVAL_MS = 15_000;

function encodeSse(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function parseCurrentIdentity(snapshot: IdentityRuntimeSnapshot | null) {
  if (!snapshot || !snapshot.current_identity || typeof snapshot.current_identity !== "object") return null;
  return snapshot.current_identity as Record<string, unknown>;
}

function parseVisualContext(snapshot: IdentityRuntimeSnapshot | null) {
  if (!snapshot || !snapshot.visual_context || typeof snapshot.visual_context !== "object") return {};
  return snapshot.visual_context as Record<string, unknown>;
}

function parseRecentSceneEvents(snapshot: IdentityRuntimeSnapshot | null) {
  if (!snapshot || !Array.isArray(snapshot.recent_scene_events)) return [];
  return snapshot.recent_scene_events
    .filter((item) => item && typeof item === "object")
    .slice(0, 10) as Array<Record<string, unknown>>;
}

function parseAwareness(snapshot: IdentityRuntimeSnapshot | null) {
  const awarenessRaw = snapshot?.awareness_state;
  const awareness = awarenessRaw && typeof awarenessRaw === "object" ? (awarenessRaw as Record<string, unknown>) : {};
  const someoneInFrame = Boolean(awareness.someone_in_frame);
  const identityConfirmed = Boolean(awareness.identity_confirmed);
  const visualContext = parseVisualContext(snapshot);
  const recentSceneEvents = parseRecentSceneEvents(snapshot);
  return {
    status: typeof snapshot?.status === "string" ? snapshot.status : "unavailable",
    someone_in_frame: someoneInFrame,
    identity_confirmed: identityConfirmed,
    awareness_state: awareness,
    current_identity: parseCurrentIdentity(snapshot),
    visual_context: visualContext,
    recent_scene_events: recentSceneEvents,
    at: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const origin = resolveRequestOrigin(req);
  const encoder = new TextEncoder();

  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastPresenceKey = "";
      let lastIdentityKey = "";
      let lastSceneKey = "";

      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let pingTimer: ReturnType<typeof setInterval> | null = null;

      const safeEnqueue = (event: string, payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeSse(event, payload)));
        } catch {
          // stream encerrado pelo cliente
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        if (pingTimer) clearInterval(pingTimer);
        try {
          controller.close();
        } catch {
          // ignore close race
        }
      };

      const pollState = async () => {
        const snapshot = await readIdentityRuntimeStatus(origin, 2_000);
        if (!snapshot) {
          safeEnqueue("identity_unavailable", { at: new Date().toISOString() });
          return;
        }

        const awareness = parseAwareness(snapshot);
        const currentIdentity = parseCurrentIdentity(snapshot);
        const visualContext = parseVisualContext(snapshot);
        const recentSceneEvents = parseRecentSceneEvents(snapshot);
        const entityId =
          currentIdentity && typeof currentIdentity.entity_id === "string" ? `${currentIdentity.entity_id}`.trim() : "";
        const presenceKey = `${awareness.status}|${awareness.someone_in_frame ? 1 : 0}|${awareness.identity_confirmed ? 1 : 0}`;
        const topSceneEvent = recentSceneEvents[0] || null;
        const sceneKey = [
          typeof visualContext.current_interlocutor_entity_id === "string" ? visualContext.current_interlocutor_entity_id : "",
          typeof visualContext.current_interlocutor_persistence_level === "number" ? visualContext.current_interlocutor_persistence_level : "",
          typeof visualContext.scene_summary === "string" ? visualContext.scene_summary : "",
          typeof (topSceneEvent?.event_type) === "string" ? topSceneEvent.event_type : "",
          typeof (topSceneEvent?.at) === "string" ? topSceneEvent.at : "",
        ].join("|");

        if (presenceKey !== lastPresenceKey) {
          lastPresenceKey = presenceKey;
          safeEnqueue("presence_changed", awareness);
        }

        if (entityId !== lastIdentityKey) {
          lastIdentityKey = entityId;
          safeEnqueue("identity_changed", {
            ...awareness,
            current_identity: currentIdentity,
          });
        }

        if (sceneKey !== lastSceneKey) {
          lastSceneKey = sceneKey;
          safeEnqueue("scene_changed", {
            ...awareness,
            visual_context: visualContext,
            recent_scene_events: recentSceneEvents,
          });
        }

        safeEnqueue("state", awareness);
      };

      safeEnqueue("ready", {
        ok: true,
        source: "proactive-assistant-events",
        poll_interval_ms: POLL_INTERVAL_MS,
        at: new Date().toISOString(),
      });
      void pollState();

      pollTimer = setInterval(() => {
        void pollState();
      }, POLL_INTERVAL_MS);

      pingTimer = setInterval(() => {
        safeEnqueue("ping", { at: new Date().toISOString() });
      }, PING_INTERVAL_MS);

      req.signal.addEventListener("abort", close);
      cleanup = close;
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
