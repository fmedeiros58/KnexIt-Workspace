export function removeEmptyParts(parts: Array<string | undefined | null | false>): string[] {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
}

