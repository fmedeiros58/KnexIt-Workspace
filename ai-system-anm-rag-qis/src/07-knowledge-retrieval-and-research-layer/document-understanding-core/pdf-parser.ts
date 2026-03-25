import { normalizeWhitespace } from "../../shared/utils/text-utils";

export function parsePdfLikeContent(raw: string): string {
  return normalizeWhitespace(raw.replace(/\f/g, " ").replace(/\s{2,}/g, " "));
}
