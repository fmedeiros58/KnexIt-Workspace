import { NextResponse } from "next/server";
import type {
  KnexReadServerTileBatchResponse,
  KnexReadServerTileFallbackResponse,
  KnexReadServerTileRequest,
  KnexReadServerTileResponse,
} from "../../../../../../knexwriter/src/modules/Knexread/native-pdf-reader/knex-pdf-engine/server-tiles";
import { renderNativeServerTile } from "../../../../../../knexwriter/src/modules/Knexread/native-pdf-reader/knex-pdf-engine/server-tiles/NativeServerTileRenderer";
import {
  createTileFallbackResponse,
  isKnexReadTileRendererEnabled,
  validateServerTileRequest,
} from "../../_serverTileRouteUtils";

export const runtime = "nodejs";

function asServerTileFallbackResponse(
  response: KnexReadServerTileResponse,
): KnexReadServerTileFallbackResponse {
  return response as KnexReadServerTileFallbackResponse;
}

function getTileRendererMaxConcurrency() {
  const configured = Number(process.env.KNEXREAD_TILE_RENDERER_MAX_CONCURRENCY);

  return Number.isFinite(configured) && configured > 0
    ? Math.max(1, Math.trunc(configured))
    : 2;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const workers = Array.from({
    length: Math.min(Math.max(1, concurrency), values.length),
  }).map(async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex]);
    }
  });

  await Promise.all(workers);

  return results;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const tiles = Array.isArray((body as { tiles?: unknown } | null)?.tiles)
    ? ((body as { tiles: unknown[] }).tiles)
    : null;

  if (!tiles || tiles.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        fallback: "tiled-canvas",
        reason: "tiles-array-required",
        tiles: [],
      } satisfies KnexReadServerTileBatchResponse,
      { status: 400 },
    );
  }

  const validated: KnexReadServerTileRequest[] = [];
  const errors: Array<{ index: number; errors: string[] }> = [];

  tiles.forEach((tile, index) => {
    const validation = validateServerTileRequest(tile);
    if ("errors" in validation) {
      errors.push({ index, errors: validation.errors });
      return;
    }

    validated.push(validation.request);
  });

  if (errors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        fallback: "tiled-canvas",
        reason: "invalid-server-tile-batch-request",
        tiles: [],
        errors,
      },
      { status: 400 },
    );
  }

  if (!isKnexReadTileRendererEnabled()) {
    const reason =
      "native-server-renderer-unavailable:server-tile-renderer-disabled";

    return NextResponse.json(
      {
        ok: false,
        fallback: "tiled-canvas",
        reason,
        tiles: validated.map(() =>
          createTileFallbackResponse(reason),
        ),
      } satisfies KnexReadServerTileBatchResponse,
      { status: 503 },
    );
  }

  const results = await mapWithConcurrency(
    validated,
    getTileRendererMaxConcurrency(),
    (tile) => renderNativeServerTile(tile),
  );
  const firstFallback = results.find((result) => !result.response.ok);
  const firstFallbackResponse =
    firstFallback && !firstFallback.response.ok
      ? asServerTileFallbackResponse(firstFallback.response)
      : undefined;

  return NextResponse.json(
    {
      ok: results.every((result) => result.response.ok),
      fallback: firstFallbackResponse?.fallback,
      reason: firstFallbackResponse?.reason,
      tiles: results.map((result) => result.response),
    } satisfies KnexReadServerTileBatchResponse,
    {
      status: firstFallbackResponse ? (firstFallback?.status ?? 501) : 200,
    },
  );
}
