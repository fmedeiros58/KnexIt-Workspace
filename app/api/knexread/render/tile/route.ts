import { NextResponse } from "next/server";
import { renderNativeServerTile } from "../../../../../knexwriter/src/modules/Knexread/native-pdf-reader/knex-pdf-engine/server-tiles/NativeServerTileRenderer";
import {
  createTileFallbackResponse,
  isKnexReadTileRendererEnabled,
  validateServerTileRequest,
} from "../_serverTileRouteUtils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = validateServerTileRequest(body);

  if ("errors" in validation) {
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        fallback: "tiled-canvas",
        reason: "invalid-server-tile-request",
        retryable: false,
        errors: validation.errors,
      },
      { status: 400 },
    );
  }

  if (!isKnexReadTileRendererEnabled()) {
    return NextResponse.json(
      createTileFallbackResponse("server-tile-renderer-disabled"),
      { status: 503 },
    );
  }

  const result = await renderNativeServerTile(validation.request);

  return NextResponse.json(result.response, { status: result.status });
}
