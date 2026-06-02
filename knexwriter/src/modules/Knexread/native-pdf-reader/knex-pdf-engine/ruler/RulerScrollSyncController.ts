import type { KnexPdfRulerState } from "../core/engineTypes";

export function computeRulerScrollSync(input: {
  rulerZeroX: number;
  scrollLeft: number;
  layoutVersion: number;
}): KnexPdfRulerState {
  return {
    rulerZeroX: input.rulerZeroX,
    scrollLeft: input.scrollLeft,
    rulerTrackX: input.rulerZeroX - input.scrollLeft,
    layoutVersion: input.layoutVersion,
  };
}
