import { NextResponse } from "next/server";
import { renderNativeServerTile } from "../../../../../knexwriter/src/modules/Knexread/native-pdf-reader/knex-pdf-engine/server-tiles/NativeServerTileRenderer";
import {
  createTileFallbackResponse,
  isKnexReadTileRendererEnabled,
  validateServerTileRequest,
} from "../_serverTileRouteUtils";

export const runtime = "nodejs";

function getServerTileRouteErrorReason(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `server-tile-route-error:${error.message}`;
  }

  return "server-tile-route-error";
}

export async function POST(request: Request) {
  let body: unknown = null;

  try {
    body = await request.json().catch(() => null);
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
        createTileFallbackResponse(
          "native-server-renderer-unavailable:server-tile-renderer-disabled",
        ),
        { status: 503 },
      );
    }

    const result = await renderNativeServerTile(validation.request);

    return NextResponse.json(result.response, { status: result.status });
  } catch (error) {
    const reason = getServerTileRouteErrorReason(error);

    // eslint-disable-next-line no-console
    console.error("[KnexRead][server-tile-route]", {
      reason,
      error,
      body,
    });

    return NextResponse.json(createTileFallbackResponse(reason), {
      status: 502,
    });
  }
}
