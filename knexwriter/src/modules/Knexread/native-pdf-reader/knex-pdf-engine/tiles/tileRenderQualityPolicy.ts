import type { KnexPdfRenderPhase } from "../rendering/RenderQualityController";

export type KnexPdfTileQualityPolicy = {
  localMaxOutputScale: number;
  serverDpi: number;
};

export function resolveTileRenderQualityPolicy(input: {
  renderPhase: KnexPdfRenderPhase;
  ultra?: boolean;
}): KnexPdfTileQualityPolicy {
  if (input.renderPhase === "settled-final") {
    return {
      localMaxOutputScale: input.ultra ? 4.5 : 4,
      serverDpi: input.ultra ? 300 : 240,
    };
  }

  if (input.renderPhase === "warmup-preview") {
    return {
      localMaxOutputScale: 2.5,
      serverDpi: 180,
    };
  }

  return {
    localMaxOutputScale: 2,
    serverDpi: 150,
  };
}
