import { NextRequest } from "next/server";
import { readConfiguredAnmBaseUrl, resolveReachableAnmBaseUrl } from "@/app/api/_shared/anm-endpoint";

export const runtime = "nodejs";

const DEFAULT_ANM_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_ANM_TIMEOUT_MS = 45_000;

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

type FallbackIdentityEntity = {
  entity_id: string;
  label: string;
  mode: string;
  confidence: number;
  source_id: string | null;
  nominal_name: string | null;
  last_seen_at: string;
};

type FallbackSearchSession = {
  session_id: string;
  target_person_id: string;
  status: "active" | "stopped";
  threshold: number;
  started_at: string;
  ended_at: string | null;
  metadata: Record<string, unknown>;
};

const FALLBACK_CAMERA_SOURCES = [
  {
    source_id: "channel-1",
    name: "Canal 1",
    source_type: "local",
    device_ref: "camera-main",
    resolution: "1280x720",
    fps: 30,
    priority: 10,
    active: true,
    connected: true,
    last_heartbeat_at: "",
  },
  {
    source_id: "channel-2",
    name: "Canal 2",
    source_type: "local",
    device_ref: "camera-left",
    resolution: "1280x720",
    fps: 30,
    priority: 20,
    active: true,
    connected: true,
    last_heartbeat_at: "",
  },
  {
    source_id: "channel-3",
    name: "Canal 3",
    source_type: "local",
    device_ref: "camera-front",
    resolution: "1280x720",
    fps: 30,
    priority: 30,
    active: true,
    connected: true,
    last_heartbeat_at: "",
  },
  {
    source_id: "channel-4",
    name: "Canal 4",
    source_type: "local",
    device_ref: "camera-right",
    resolution: "1280x720",
    fps: 30,
    priority: 40,
    active: true,
    connected: true,
    last_heartbeat_at: "",
  },
];

const fallbackRuntimeState: {
  runtime_enabled: boolean;
  runtime_paused: boolean;
  auto_start_enabled: boolean;
  selected_source_id: string | null;
  tracked_entities: FallbackIdentityEntity[];
  search_sessions: Record<string, FallbackSearchSession>;
  updated_at: string;
} = {
  runtime_enabled: false,
  runtime_paused: false,
  auto_start_enabled: false,
  selected_source_id: "channel-1",
  tracked_entities: [],
  search_sessions: {},
  updated_at: new Date().toISOString(),
};

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
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

function readProxyConfig() {
  const anmBaseUrl = readConfiguredAnmBaseUrl(
    pickFirstNonEmpty(readAnmCompatEnv("AI_SYSTEM_ANM_API_BASE_URL", "ANM_API_BASE_URL"), DEFAULT_ANM_BASE_URL),
  );
  const parsedTimeout = Number(
    readAnmCompatEnv("AI_SYSTEM_ANM_API_TIMEOUT_MS", "ANM_API_TIMEOUT_MS") || DEFAULT_ANM_TIMEOUT_MS,
  );
  const timeoutMs = Number.isFinite(parsedTimeout) ? Math.max(2_000, Math.round(parsedTimeout)) : DEFAULT_ANM_TIMEOUT_MS;
  return { anmBaseUrl, timeoutMs };
}

function nowIso() {
  return new Date().toISOString();
}

function touchFallbackRuntime() {
  fallbackRuntimeState.updated_at = nowIso();
}

function computeFallbackStatus() {
  if (!fallbackRuntimeState.runtime_enabled) return "disabled";
  if (fallbackRuntimeState.runtime_paused) return "paused";
  if (fallbackRuntimeState.tracked_entities.length) return "identified";
  return "monitoring";
}

function parseBodyJson(body?: ArrayBuffer) {
  if (!body || body.byteLength <= 0) return null;
  try {
    const text = new TextDecoder("utf-8").decode(body);
    if (!text.trim()) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildFallbackSnapshot() {
  const heartbeat = fallbackRuntimeState.updated_at || nowIso();
  const camera_sources = FALLBACK_CAMERA_SOURCES.map((source) => ({
    ...source,
    last_heartbeat_at: heartbeat,
    active: source.active,
    connected: source.connected,
  }));

  const active_streams =
    fallbackRuntimeState.runtime_enabled && !fallbackRuntimeState.runtime_paused
      ? camera_sources.map((source) => ({
          stream_id: `stream-${source.source_id}`,
          source_id: source.source_id,
          status: "active",
          fps_observed: source.fps,
          latency_ms: 25,
          dropped_frames: 0,
        }))
      : [];

  const tracked_entities = fallbackRuntimeState.tracked_entities.map((entity) => ({ ...entity }));
  const current_identity = tracked_entities.length ? tracked_entities[0] : null;
  const visual_context = {
    scene_summary: current_identity
      ? `Interlocutor atual: ${current_identity.label}; fonte ${current_identity.source_id || fallbackRuntimeState.selected_source_id || "desconhecida"}; identidade confirmada.`
      : "Nenhuma pessoa em quadro.",
    presence_duration_ms: 0,
    current_interlocutor_duration_ms: 0,
    current_interlocutor_stable: Boolean(current_identity),
    current_interlocutor_persistence_level: current_identity ? 1 : 0,
    current_interlocutor_entity_id: current_identity?.entity_id || null,
    current_interlocutor_label: current_identity?.label || null,
    source_id: current_identity?.source_id || fallbackRuntimeState.selected_source_id || null,
    interlocutor_switched: false,
    tracked_entities_count: tracked_entities.length,
    recent_scene_event_count: current_identity ? 1 : 0,
  };
  const recent_scene_events = current_identity
    ? [
        {
          event_type: "fallback_identity_detected",
          at: heartbeat,
          entity_id: current_identity.entity_id,
          label: current_identity.label,
          source_id: current_identity.source_id,
          confidence: current_identity.confidence,
          summary: `Interlocutor ${current_identity.label} detectado em modo fallback.`,
          payload: { fallback_mode: true },
        },
      ]
    : [];

  return {
    status: computeFallbackStatus(),
    runtime_enabled: fallbackRuntimeState.runtime_enabled,
    runtime_paused: fallbackRuntimeState.runtime_paused,
    auto_start_enabled: fallbackRuntimeState.auto_start_enabled,
    selected_source_id: fallbackRuntimeState.selected_source_id,
    awareness_state: {
      someone_in_frame: tracked_entities.length > 0,
      visual_source: fallbackRuntimeState.selected_source_id || "channel-1",
      identity_confirmed: Boolean(current_identity),
      identity_conflict: false,
      interlocutor_switched: false,
    },
    camera_sources,
    active_streams,
    tracked_entities,
    current_identity,
    visual_context,
    recent_scene_events,
    self_model_state: { fallback_mode: true, detail: "identity_runtime_unavailable" },
    user_pattern_state: { fallback_mode: true, detail: "identity_runtime_unavailable" },
    last_error: undefined,
    updated_at: fallbackRuntimeState.updated_at,
  };
}

function upsertFallbackEntityFromObservation(payload: Record<string, unknown> | null) {
  if (!payload) return;
  const faceDetected = payload.face_detected !== false;
  if (!faceDetected) {
    fallbackRuntimeState.tracked_entities = [];
    return;
  }
  const entityIdRaw = typeof payload.entity_id === "string" ? payload.entity_id.trim() : "";
  const entity_id = entityIdRaw || "person_01";
  const labelRaw = typeof payload.label === "string" ? payload.label.trim() : "";
  const modeRaw = typeof payload.mode === "string" ? payload.mode.trim() : "";
  const sourceRaw = typeof payload.source_id === "string" ? payload.source_id.trim() : "";
  const nominalRaw = typeof payload.nominal_name === "string" ? payload.nominal_name.trim() : "";
  const confidenceNum = Number(payload.confidence);
  const confidence = Number.isFinite(confidenceNum) ? Math.max(0, Math.min(1, confidenceNum)) : 0.82;
  const nextEntity: FallbackIdentityEntity = {
    entity_id,
    label: labelRaw || entity_id,
    mode: modeRaw || "reidentification",
    confidence,
    source_id: sourceRaw || fallbackRuntimeState.selected_source_id,
    nominal_name: nominalRaw || null,
    last_seen_at: nowIso(),
  };
  const remaining = fallbackRuntimeState.tracked_entities.filter((item) => item.entity_id !== entity_id);
  fallbackRuntimeState.tracked_entities = [nextEntity, ...remaining].slice(0, 6);
}

function fallbackIdentityResponse(method: string, segments: string[], body?: ArrayBuffer) {
  const path = segments.map((segment) => segment.trim()).filter(Boolean).join("/");
  const normalizedMethod = method.toUpperCase();
  const bodyJson = parseBodyJson(body);
  const fallbackHeaders = { "x-identity-fallback": "1" };

  if (normalizedMethod === "GET") {
    if (!path || path === "panel" || path === "runtime/status") {
      touchFallbackRuntime();
      return Response.json(buildFallbackSnapshot(), { status: 200, headers: fallbackHeaders });
    }
    if (path === "sources") {
      touchFallbackRuntime();
      const snapshot = buildFallbackSnapshot();
      return Response.json(
        {
          ok: true,
          fallback: true,
          sources: snapshot.camera_sources,
          selected_source_id: snapshot.selected_source_id,
        },
        { status: 200, headers: fallbackHeaders },
      );
    }
    if (path.startsWith("recognition/status/")) {
      const sessionId = path.slice("recognition/status/".length).trim();
      const session = fallbackRuntimeState.search_sessions[sessionId];
      if (!session) {
        return Response.json(
          {
            ok: false,
            fallback: true,
            message: "session_not_found",
          },
          { status: 404, headers: fallbackHeaders },
        );
      }
      return Response.json(
        {
          ok: true,
          fallback: true,
          session_id: session.session_id,
          status: session.status,
          payload: session,
        },
        { status: 200, headers: fallbackHeaders },
      );
    }
    return null;
  }

  if (normalizedMethod === "POST") {
    if (path === "frame/analyze") {
      const sourceIdRaw = typeof bodyJson?.source_id === "string" ? bodyJson.source_id.trim() : "";
      const expectedViewRaw = typeof bodyJson?.expected_view === "string" ? bodyJson.expected_view.trim() : "";
      touchFallbackRuntime();
      return Response.json(
        {
          ok: true,
          fallback: true,
          source_id: sourceIdRaw || fallbackRuntimeState.selected_source_id || "channel-1",
          face_detected: false,
          expected_view: expectedViewRaw || null,
          confidence: 0,
          suggested_mode: "tracking",
          validation_pending: true,
          runtime_observation_emitted: false,
          face_box: null,
          pose: null,
          quality: null,
          faces: [],
          metadata: {
            fallback_reason: "anm_api_unreachable",
            should_capture: false,
            faces_count: 0,
          },
        },
        { status: 200, headers: fallbackHeaders },
      );
    }
    if (path === "recognition/search/start") {
      const targetPersonIdRaw = typeof bodyJson?.target_person_id === "string" ? bodyJson.target_person_id.trim() : "";
      if (!targetPersonIdRaw) {
        return Response.json(
          {
            ok: false,
            fallback: true,
            message: "target_person_id_required",
          },
          { status: 400, headers: fallbackHeaders },
        );
      }
      const thresholdNum = Number(bodyJson?.threshold);
      const threshold = Number.isFinite(thresholdNum) ? Math.max(0, Math.min(1, thresholdNum)) : 0.72;
      const session: FallbackSearchSession = {
        session_id: `srch-fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        target_person_id: targetPersonIdRaw,
        status: "active",
        threshold,
        started_at: nowIso(),
        ended_at: null,
        metadata:
          bodyJson && typeof bodyJson.metadata === "object" && !Array.isArray(bodyJson.metadata)
            ? (bodyJson.metadata as Record<string, unknown>)
            : {},
      };
      fallbackRuntimeState.search_sessions[session.session_id] = session;
      touchFallbackRuntime();
      return Response.json(
        {
          ok: true,
          fallback: true,
          session_id: session.session_id,
          status: session.status,
          payload: session,
        },
        { status: 200, headers: fallbackHeaders },
      );
    }
    if (path === "recognition/search/stop") {
      const sessionId = typeof bodyJson?.session_id === "string" ? bodyJson.session_id.trim() : "";
      if (!sessionId) {
        return Response.json(
          {
            ok: false,
            fallback: true,
            message: "session_id_required",
          },
          { status: 400, headers: fallbackHeaders },
        );
      }
      const session = fallbackRuntimeState.search_sessions[sessionId];
      if (!session) {
        return Response.json(
          {
            ok: false,
            fallback: true,
            message: "search_session_not_found",
          },
          { status: 404, headers: fallbackHeaders },
        );
      }
      session.status = "stopped";
      session.ended_at = nowIso();
      touchFallbackRuntime();
      return Response.json(
        {
          ok: true,
          fallback: true,
          session_id: session.session_id,
          status: session.status,
          payload: session,
        },
        { status: 200, headers: fallbackHeaders },
      );
    }

    if (path === "runtime/enable") {
      fallbackRuntimeState.runtime_enabled = true;
      fallbackRuntimeState.runtime_paused = false;
    } else if (path === "runtime/disable") {
      fallbackRuntimeState.runtime_enabled = false;
      fallbackRuntimeState.runtime_paused = false;
    } else if (path === "runtime/pause") {
      fallbackRuntimeState.runtime_paused = true;
    } else if (path === "runtime/resume") {
      fallbackRuntimeState.runtime_enabled = true;
      fallbackRuntimeState.runtime_paused = false;
    } else if (path === "runtime/auto-start") {
      fallbackRuntimeState.auto_start_enabled = Boolean(bodyJson?.enabled);
    } else if (path === "sources/select") {
      const sourceIdRaw = typeof bodyJson?.source_id === "string" ? bodyJson.source_id.trim() : "";
      if (sourceIdRaw) {
        fallbackRuntimeState.selected_source_id = sourceIdRaw;
      }
    } else if (path === "sources/discover") {
      // no-op in fallback mode
    } else if (path === "events/observation") {
      upsertFallbackEntityFromObservation(bodyJson);
    } else {
      return null;
    }

    touchFallbackRuntime();
    const snapshot = buildFallbackSnapshot();
    if (path === "sources/discover") {
      return Response.json(
        {
          ok: true,
          fallback: true,
          sources: snapshot.camera_sources,
          runtime: snapshot,
        },
        { status: 200, headers: fallbackHeaders },
      );
    }
    return Response.json(
      {
        ok: true,
        fallback: true,
        runtime: snapshot,
      },
      { status: 200, headers: fallbackHeaders },
    );
  }

  return null;
}

function buildTargetUrl(req: NextRequest, segments: string[], anmBaseUrl: string) {
  const safePath = segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const basePath = safePath ? `/identity/${safePath}` : "/identity";
  const search = req.nextUrl.search || "";
  return `${anmBaseUrl}${basePath}${search}`;
}

async function proxyIdentityRequest(req: NextRequest, context: RouteContext) {
  const method = req.method.toUpperCase();
  const resolvedParams = await context.params;
  const segments = Array.isArray(resolvedParams?.path) ? resolvedParams.path : [];
  const { anmBaseUrl, timeoutMs } = readProxyConfig();
  const anmResolution = await resolveReachableAnmBaseUrl({
    configuredBaseUrl: anmBaseUrl,
    timeoutMs: Math.min(2_000, timeoutMs),
    healthPath: "/healthz",
  });
  const targetUrl = buildTargetUrl(req, segments, anmResolution.baseUrl);
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);
  const xRequestId = req.headers.get("x-request-id");
  if (xRequestId) headers.set("x-request-id", xRequestId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? body : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    if (upstream.status === 404) {
      const fallback = fallbackIdentityResponse(method, segments, body);
      if (fallback) {
        return fallback;
      }
    }
    if (upstream.status === 503 && segments.join("/").trim() === "frame/analyze") {
      const fallback = fallbackIdentityResponse(method, segments, body);
      if (fallback) {
        return fallback;
      }
    }
    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) responseHeaders.set("content-type", upstreamType);
    const upstreamRequestId = upstream.headers.get("x-request-id");
    if (upstreamRequestId) responseHeaders.set("x-request-id", upstreamRequestId);
    if (upstream.status === 503) {
      responseHeaders.set("x-identity-upstream-error", "1");
    }
    responseHeaders.set("x-anm-base-url", anmResolution.baseUrl);

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const fallback = fallbackIdentityResponse(method, segments, body);
    if (fallback) {
      return fallback;
    }
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "IDENTITY_PROXY_TIMEOUT"
        : error instanceof Error
          ? error.message || "IDENTITY_PROXY_ERROR"
          : "IDENTITY_PROXY_ERROR";
    return Response.json(
      {
        ok: false,
        code: "IDENTITY_PROXY_ERROR",
        message: `${message}; ANM=${anmResolution.baseUrl}; tentados=${anmResolution.attemptedBaseUrls.join(",")}`,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  return proxyIdentityRequest(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return proxyIdentityRequest(req, context);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return proxyIdentityRequest(req, context);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  return proxyIdentityRequest(req, context);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return proxyIdentityRequest(req, context);
}

