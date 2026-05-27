import { removeEmptyParts } from "./removeEmptyParts";

export function joinClean(parts: Array<string | undefined | null | false>, separator = " "): string {
  return removeEmptyParts(parts).join(separator).replace(/\s+/g, " ").trim();
}

