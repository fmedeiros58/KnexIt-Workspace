import { calculateKnexPdfContentWidth } from "../layout/ContentWidthCalculator";
import { computeHorizontalOverflow } from "../viewport/HorizontalOverflowController";

export function createKnexReadLayoutIntegration(input: {
  sourcePageWidth: number;
  viewportWidth: number;
  mode: "single" | "sideBySide";
  translationPageWidth?: number;
}) {
  const realContentWidth = calculateKnexPdfContentWidth({
    sourcePageWidth: input.sourcePageWidth,
    mode: input.mode,
    translationPageWidth: input.translationPageWidth,
  });
  return {
    realContentWidth,
    overflow: computeHorizontalOverflow({
      viewportWidth: input.viewportWidth,
      realContentWidth,
      activeContentCenterX: realContentWidth / 2,
    }),
  };
}
