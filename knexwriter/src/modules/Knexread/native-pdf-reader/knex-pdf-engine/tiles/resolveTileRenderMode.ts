import type {
  KnexPdfResolvedTileRenderMode,
  KnexPdfVisualRenderMode,
} from "./TileRenderTypes";

export function resolveTileRenderMode(input: {
  visualRenderMode: KnexPdfVisualRenderMode;
  serverAvailable?: boolean;
  localAvailable?: boolean;
}): KnexPdfResolvedTileRenderMode {
  if (input.visualRenderMode === "page-canvas") {
    return "page-canvas";
  }

  if (input.visualRenderMode === "tiled-canvas") {
    return "tiled-canvas";
  }

  if (input.visualRenderMode === "server-tiled") {
    return input.serverAvailable ? "server-tiled" : "tiled-canvas";
  }

  if (input.serverAvailable) {
    return "server-tiled";
  }

  return input.localAvailable === false ? "page-canvas" : "tiled-canvas";
}
