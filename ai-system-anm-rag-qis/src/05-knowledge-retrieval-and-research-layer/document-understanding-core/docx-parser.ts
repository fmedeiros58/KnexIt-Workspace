import { normalizeWhitespace } from "../../shared/utils/text-utils";

export function parseDocxLikeContent(raw: string): string {
  return normalizeWhitespace(raw.replace(/\u0000/g, " "));
}
