export interface PdfOcrNeedInput {
  forceOcr?: boolean;
  nativeTextBlockCount: number;
  nativeTextConfidence?: number;
  imageCoverageRatio?: number;
  pageAreaPx?: number;
}

export interface PdfOcrNeedDecision {
  shouldRunOcr: boolean;
  reason:
    | "forced"
    | "no-native-text"
    | "low-native-text-confidence"
    | "image-dominant-page"
    | "native-text-sufficient";
}

export function detectPdfOcrNeed(input: PdfOcrNeedInput): PdfOcrNeedDecision {
  if (input.forceOcr) {
    return { shouldRunOcr: true, reason: "forced" };
  }

  if (input.nativeTextBlockCount <= 0) {
    return { shouldRunOcr: true, reason: "no-native-text" };
  }

  if (
    typeof input.nativeTextConfidence === "number" &&
    input.nativeTextConfidence < 0.45
  ) {
    return { shouldRunOcr: true, reason: "low-native-text-confidence" };
  }

  if (
    typeof input.imageCoverageRatio === "number" &&
    input.imageCoverageRatio >= 0.75 &&
    input.nativeTextBlockCount < 5
  ) {
    return { shouldRunOcr: true, reason: "image-dominant-page" };
  }

  return { shouldRunOcr: false, reason: "native-text-sufficient" };
}
