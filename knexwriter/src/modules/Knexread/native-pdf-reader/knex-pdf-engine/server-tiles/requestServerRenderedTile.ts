import type {
  KnexReadServerTileBatchRequest,
  KnexReadServerTileBatchResponse,
  KnexReadServerTileRequest,
  KnexReadServerTileResponse,
} from "./ServerTileTypes";

const DEFAULT_TILE_ENDPOINT = "/api/knexread/render/tile";
const DEFAULT_TILE_BATCH_ENDPOINT = "/api/knexread/render/tiles/batch";
export const SERVER_TILE_CIRCUIT_BREAKER_EVENT =
  "knex-server-tile-circuit-breaker-change";

/**
 * Circuit breaker do server-tiled.
 *
 * Objetivo:
 * - evitar dezenas de POSTs 502 por página quando o endpoint server-side falha;
 * - cair rapidamente para tiled-canvas local;
 * - manter diagnóstico claro no console;
 * - permitir reset manual sem recarregar a aplicação.
 */
const SERVER_TILE_FAILURE_THRESHOLD = 1;
const SERVER_TILE_MAX_IN_FLIGHT_PROBES = 2;
const SERVER_TILE_COOLDOWN_MS = 30_000;

type ServerTileFallbackStatus = "fallback-required" | "error";

type ServerTileCircuitBreakerState = {
  failureCount: number;
  inFlightCount: number;
  openUntil: number;
  lastFailureAt: number;
  lastReason: string;
  manuallyDisabled: boolean;
  revision: number;
};

const SERVER_TILE_CIRCUIT_BREAKER_STATE_KEY =
  "__KNEX_SERVER_TILE_CIRCUIT_BREAKER_STATE__";

function createInitialServerTileCircuitBreakerState(): ServerTileCircuitBreakerState {
  return {
    failureCount: 0,
    inFlightCount: 0,
    openUntil: 0,
    lastFailureAt: 0,
    lastReason: "",
    manuallyDisabled: false,
    revision: 0,
  };
}

function getServerTileCircuitBreakerSharedState() {
  const record = globalThis as unknown as Record<string, unknown>;
  const current = record[SERVER_TILE_CIRCUIT_BREAKER_STATE_KEY];

  if (current && typeof current === "object") {
    return current as ServerTileCircuitBreakerState;
  }

  const next = createInitialServerTileCircuitBreakerState();
  record[SERVER_TILE_CIRCUIT_BREAKER_STATE_KEY] = next;
  return next;
}

const serverTileCircuitBreaker = getServerTileCircuitBreakerSharedState();

function nowMs(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function createFallbackResponse(
  reason: string,
  options?: {
    retryable?: boolean;
    status?: ServerTileFallbackStatus;
  },
): KnexReadServerTileResponse {
  return {
    ok: false,
    status: options?.status ?? "fallback-required",
    fallback: "tiled-canvas",
    reason,
    retryable: options?.retryable ?? true,
  };
}

function getCircuitBreakerRemainingMs(): number {
  if (serverTileCircuitBreaker.manuallyDisabled) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.ceil(serverTileCircuitBreaker.openUntil - nowMs()));
}

export function isServerTileCircuitBreakerOpen(): boolean {
  return (
    serverTileCircuitBreaker.manuallyDisabled ||
    serverTileCircuitBreaker.openUntil > nowMs()
  );
}

export function getServerTileCircuitOpenReason(): string {
  if (serverTileCircuitBreaker.manuallyDisabled) {
    return "server-tiles-disabled";
  }

  if (isServerTileCircuitBreakerOpen()) {
    return "server-tile-circuit-open";
  }

  return "";
}

function createCircuitOpenFallback(): KnexReadServerTileResponse {
  return createFallbackResponse("server-tile-circuit-open", {
    retryable: false,
    status: "fallback-required",
  });
}

function createProbeLimitFallback(reason: string): KnexReadServerTileResponse {
  return createFallbackResponse(reason, {
    retryable: false,
    status: "fallback-required",
  });
}

function syncServerTileCircuitBreakerGlobals() {
  if (typeof globalThis !== "undefined") {
    const record = globalThis as unknown as Record<string, unknown>;
    record.KNEX_PDF_SERVER_TILE_CIRCUIT_OPEN =
      isServerTileCircuitBreakerOpen();
    record.KNEX_PDF_SERVER_TILE_CIRCUIT_REASON =
      getServerTileCircuitOpenReason() || serverTileCircuitBreaker.lastReason;
  }
}

function notifyServerTileCircuitBreakerChange() {
  serverTileCircuitBreaker.revision += 1;
  syncServerTileCircuitBreakerGlobals();

  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(SERVER_TILE_CIRCUIT_BREAKER_EVENT, {
      detail: getServerTileCircuitBreakerState(),
    }),
  );
}

function registerServerTileSuccess() {
  const wasOpen = isServerTileCircuitBreakerOpen();

  serverTileCircuitBreaker.failureCount = 0;
  serverTileCircuitBreaker.openUntil = 0;
  serverTileCircuitBreaker.lastFailureAt = 0;
  serverTileCircuitBreaker.lastReason = "";

  if (wasOpen) {
    notifyServerTileCircuitBreakerChange();
  }
}

function registerServerTileFailure(reason: string) {
  const timestamp = nowMs();

  serverTileCircuitBreaker.failureCount += 1;
  serverTileCircuitBreaker.lastFailureAt = timestamp;
  serverTileCircuitBreaker.lastReason = reason;

  if (serverTileCircuitBreaker.failureCount >= SERVER_TILE_FAILURE_THRESHOLD) {
    serverTileCircuitBreaker.openUntil =
      timestamp + SERVER_TILE_COOLDOWN_MS;
    notifyServerTileCircuitBreakerChange();
  }
}

function registerServerTileNonFatalFailure(reason: string) {
  serverTileCircuitBreaker.lastFailureAt = nowMs();
  serverTileCircuitBreaker.lastReason = reason;
  notifyServerTileCircuitBreakerChange();
}

function shouldOpenCircuitForHttpStatus(status: number): boolean {
  return status >= 500;
}

function beginServerTileProbe(): boolean {
  if (isServerTileCircuitBreakerOpen()) return false;

  if (
    serverTileCircuitBreaker.inFlightCount >=
    SERVER_TILE_MAX_IN_FLIGHT_PROBES
  ) {
    return false;
  }

  serverTileCircuitBreaker.inFlightCount += 1;
  notifyServerTileCircuitBreakerChange();
  return true;
}

function endServerTileProbe() {
  if (serverTileCircuitBreaker.inFlightCount <= 0) return;

  serverTileCircuitBreaker.inFlightCount -= 1;
  notifyServerTileCircuitBreakerChange();
}

export function resetServerTileCircuitBreaker() {
  serverTileCircuitBreaker.manuallyDisabled = false;
  registerServerTileSuccess();
  notifyServerTileCircuitBreakerChange();
}

export function disableServerTiles(reason = "server-tiles-disabled") {
  serverTileCircuitBreaker.manuallyDisabled = true;
  serverTileCircuitBreaker.lastReason = reason;
  serverTileCircuitBreaker.openUntil = Number.POSITIVE_INFINITY;
  notifyServerTileCircuitBreakerChange();
}

export function getServerTileCircuitBreakerState() {
  syncServerTileCircuitBreakerGlobals();

  return {
    ...serverTileCircuitBreaker,
    open: isServerTileCircuitBreakerOpen(),
    remainingMs: getCircuitBreakerRemainingMs(),
    failureThreshold: SERVER_TILE_FAILURE_THRESHOLD,
    maxInFlightProbes: SERVER_TILE_MAX_IN_FLIGHT_PROBES,
    cooldownMs: SERVER_TILE_COOLDOWN_MS,
  };
}

function exposeServerTileDiagnostics() {
  if (typeof globalThis === "undefined") return;

  const record = globalThis as unknown as Record<string, unknown>;

  record.__KNEX_SERVER_TILE_CIRCUIT_BREAKER__ = {
    state: getServerTileCircuitBreakerState,
    reset: resetServerTileCircuitBreaker,
    disableServerTiles,
  };
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

function getResponseReason(input: {
  response: Response;
  body: unknown;
  fallbackReason: string;
}): string {
  if (
    input.body &&
    typeof input.body === "object" &&
    "reason" in input.body &&
    typeof (input.body as { reason?: unknown }).reason === "string"
  ) {
    return (input.body as { reason: string }).reason;
  }

  return `${input.fallbackReason}-${input.response.status}`;
}

function getTileResponseReason(
  body: KnexReadServerTileResponse,
  fallback: string,
): string {
  if (
    "reason" in body &&
    typeof body.reason === "string" &&
    body.reason.length > 0
  ) {
    return body.reason;
  }

  return fallback;
}

function getBatchResponseReason(
  body: KnexReadServerTileBatchResponse,
  fallback: string,
): string {
  if (
    "reason" in body &&
    typeof body.reason === "string" &&
    body.reason.length > 0
  ) {
    return body.reason;
  }

  return fallback;
}

function normalizeServerTileResponse(input: {
  response: Response;
  body: KnexReadServerTileResponse | null;
}): KnexReadServerTileResponse {
  if (!input.response.ok) {
    const reason = getResponseReason({
      response: input.response,
      body: input.body,
      fallbackReason: "server-tile-http",
    });

    if (shouldOpenCircuitForHttpStatus(input.response.status)) {
      registerServerTileFailure(reason);
    } else {
      registerServerTileNonFatalFailure(reason);
    }

    return createFallbackResponse(reason, {
      retryable: input.response.status >= 500,
    });
  }

  if (!input.body) {
    const reason = `server-tile-empty-json-${input.response.status}`;
    registerServerTileFailure(reason);

    return createFallbackResponse(reason);
  }

  if (input.body.ok) {
    registerServerTileSuccess();
    return input.body;
  }

  const reason = getTileResponseReason(input.body, "server-tile-not-ok");

  if (input.body.retryable) {
    registerServerTileFailure(reason);
  } else {
    registerServerTileNonFatalFailure(reason);
  }

  return input.body;
}

function normalizeServerTileBatchResponse(input: {
  response: Response;
  body: KnexReadServerTileBatchResponse | null;
}): KnexReadServerTileBatchResponse {
  if (!input.response.ok) {
    const reason = getResponseReason({
      response: input.response,
      body: input.body,
      fallbackReason: "server-tile-batch-http",
    });

    if (shouldOpenCircuitForHttpStatus(input.response.status)) {
      registerServerTileFailure(reason);
    } else {
      registerServerTileNonFatalFailure(reason);
    }

    return {
      ok: false,
      fallback: "tiled-canvas",
      reason,
      tiles: [],
    };
  }

  if (!input.body) {
    const reason = `server-tile-batch-empty-json-${input.response.status}`;
    registerServerTileFailure(reason);

    return {
      ok: false,
      fallback: "tiled-canvas",
      reason,
      tiles: [],
    };
  }

  if (input.body.ok) {
    registerServerTileSuccess();
    return input.body;
  }

  registerServerTileNonFatalFailure(
    getBatchResponseReason(input.body, "server-tile-batch-not-ok"),
  );

  return input.body;
}

export async function requestServerRenderedTile(input: {
  request: KnexReadServerTileRequest;
  endpoint?: string;
  signal?: AbortSignal;
}): Promise<KnexReadServerTileResponse> {
  exposeServerTileDiagnostics();

  if (input.signal?.aborted) {
    return createFallbackResponse("server-tile-request-aborted", {
      retryable: false,
    });
  }

  if (isServerTileCircuitBreakerOpen()) {
    return createCircuitOpenFallback();
  }

  if (!beginServerTileProbe()) {
    return isServerTileCircuitBreakerOpen()
      ? createCircuitOpenFallback()
      : createProbeLimitFallback("server-tile-probe-limit");
  }

  try {
    const response = await fetch(input.endpoint ?? DEFAULT_TILE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.request),
      signal: input.signal,
    });

    const body = await readJsonResponse<KnexReadServerTileResponse>(response);

    return normalizeServerTileResponse({
      response,
      body,
    });
  } catch (error) {
    if (input.signal?.aborted) {
      return createFallbackResponse("server-tile-request-aborted", {
        retryable: false,
      });
    }

    const reason =
      error instanceof Error ? error.message : "server-tile-request-failed";

    registerServerTileFailure(reason);

    return createFallbackResponse(reason);
  } finally {
    endServerTileProbe();
  }
}

export async function requestServerRenderedTilesBatch(input: {
  request: KnexReadServerTileBatchRequest;
  endpoint?: string;
  signal?: AbortSignal;
}): Promise<KnexReadServerTileBatchResponse> {
  exposeServerTileDiagnostics();

  if (input.signal?.aborted) {
    return {
      ok: false,
      fallback: "tiled-canvas",
      reason: "server-tile-batch-aborted",
      tiles: [],
    };
  }

  if (isServerTileCircuitBreakerOpen()) {
    return {
      ok: false,
      fallback: "tiled-canvas",
      reason: "server-tile-circuit-open",
      tiles: [],
    };
  }

  if (!beginServerTileProbe()) {
    return {
      ok: false,
      fallback: "tiled-canvas",
      reason: isServerTileCircuitBreakerOpen()
        ? "server-tile-circuit-open"
        : "server-tile-probe-limit",
      tiles: [],
    };
  }

  try {
    const response = await fetch(
      input.endpoint ?? DEFAULT_TILE_BATCH_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input.request),
        signal: input.signal,
      },
    );

    const body =
      await readJsonResponse<KnexReadServerTileBatchResponse>(response);

    return normalizeServerTileBatchResponse({
      response,
      body,
    });
  } catch (error) {
    if (input.signal?.aborted) {
      return {
        ok: false,
        fallback: "tiled-canvas",
        reason: "server-tile-batch-aborted",
        tiles: [],
      };
    }

    const reason =
      error instanceof Error ? error.message : "server-tile-batch-failed";

    registerServerTileFailure(reason);

    return {
      ok: false,
      fallback: "tiled-canvas",
      reason,
      tiles: [],
    };
  } finally {
    endServerTileProbe();
  }
}
