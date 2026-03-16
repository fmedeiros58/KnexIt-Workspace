import { normalizeWhitespace } from "../../shared/utils/text-utils";

export function parseHtmlContent(raw: string): string {
  const withoutTags = raw.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(withoutTags);
}
