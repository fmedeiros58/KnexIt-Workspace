import type { KnexPdfSelectionRectangle } from "../core/engineTypes";

export type SelectionOverlayLayerModel = {
  rectangles: KnexPdfSelectionRectangle[];
  color: string;
};

export function createSelectionOverlayLayer(rectangles: KnexPdfSelectionRectangle[]): SelectionOverlayLayerModel {
  return {
    rectangles,
    color: "rgba(80, 120, 255, 0.22)",
  };
}
