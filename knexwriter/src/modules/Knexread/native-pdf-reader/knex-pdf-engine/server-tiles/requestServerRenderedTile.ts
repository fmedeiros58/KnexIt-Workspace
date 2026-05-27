import type {
  KnexReadServerTileBatchRequest,
  KnexReadServerTileBatchResponse,
  KnexReadServerTileRequest,
  KnexReadServerTileResponse,
} from "./ServerTileTypes";

const DEFAULT_TILE_ENDPOINT = "/api/knexread/render/tile";
const DEFAULT_TILE_BATCH_ENDPOINT = "/api/knexread/render/tiles/batch";

function createFallbackResponse(reason: string): KnexReadServerTileResponse {
  return {
    ok: false,
    status: "fallback-required",
    fallback: "tiled-canvas",
    reason,
    retryable: true,
  };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | null;

  if (!body) {
    throw new Error(`Server tile renderer returned HTTP ${response.status}.`);
  }

  return body;
}

export async function requestServerRenderedTile(input: {
  request: KnexReadServerTileRequest;
  endpoint?: string;
  signal?: AbortSignal;
}): Promise<KnexReadServerTileResponse> {
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
    return body;
  } catch (error) {
    if (input.signal?.aborted) {
      return createFallbackResponse("server-tile-request-aborted");
    }

    return createFallbackResponse(
      error instanceof Error ? error.message : "server-tile-request-failed",
    );
  }
}

export async function requestServerRenderedTilesBatch(input: {
  request: KnexReadServerTileBatchRequest;
  endpoint?: string;
  signal?: AbortSignal;
}): Promise<KnexReadServerTileBatchResponse> {
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

    return await readJsonResponse<KnexReadServerTileBatchResponse>(response);
  } catch (error) {
    return {
      ok: false,
      fallback: "tiled-canvas",
      reason:
        error instanceof Error ? error.message : "server-tile-batch-failed",
      tiles: [],
    };
  }
}
