import type {
  KnexPdfServerTileFallbackReason,
  KnexPdfVisualRenderMode,
} from "../tiles/TileRenderTypes";

export type ServerTileFallbackDecision = {
  renderMode: "server-tiled" | "tiled-canvas";
  fallbackUsed: boolean;
  reason?: KnexPdfServerTileFallbackReason | string;
};

export function resolveServerTileFallbackPolicy(input: {
  visualRenderMode: KnexPdfVisualRenderMode;
  serverAvailable: boolean;
  localTilesAvailable?: boolean;
  reason?: KnexPdfServerTileFallbackReason | string;
}): ServerTileFallbackDecision {
  const localTilesAvailable = input.localTilesAvailable !== false;

  if (input.visualRenderMode === "tiled-canvas") {
    return {
      renderMode: "tiled-canvas",
      fallbackUsed: false,
    };
  }

  if (input.serverAvailable) {
    return {
      renderMode: "server-tiled",
      fallbackUsed: false,
    };
  }

  if (localTilesAvailable) {
    return {
      renderMode: "tiled-canvas",
      fallbackUsed: true,
      reason: input.reason ?? "server-disabled",
    };
  }

  return {
    renderMode: "tiled-canvas",
    fallbackUsed: true,
    reason: input.reason ?? "server-disabled",
  };
}
