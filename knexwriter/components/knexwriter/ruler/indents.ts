import type { ParagraphIndents } from "./rulerTypes";

export function clampIndentValue(value: number, min = -400, max = 400) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeParagraphIndents(indents: ParagraphIndents): ParagraphIndents {
  return {
    leftPx: clampIndentValue(indents.leftPx),
    rightPx: clampIndentValue(indents.rightPx),
    firstLinePx: clampIndentValue(indents.firstLinePx),
    hangingPx: clampIndentValue(indents.hangingPx),
  };
}

