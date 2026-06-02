import type { ReferenceStyle } from "./core/ReferenceStyle";
import { DEFAULT_REFERENCE_STYLE } from "./core/ReferenceStyle";

export function resolveReferenceStyle(style: ReferenceStyle | undefined): ReferenceStyle {
  return style || DEFAULT_REFERENCE_STYLE;
}

