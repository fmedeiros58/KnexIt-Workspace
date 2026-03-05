function normalize(text: string) {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitParagraphs(text: string) {
  return `${text || ""}`
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((row) => row.trim())
    .filter(Boolean);
}

export class RedundancyFilterService {
  apply(text: string) {
    const paragraphs = splitParagraphs(text);
    if (paragraphs.length <= 1) return `${text || ""}`.trim();
    const seen = new Set<string>();
    const filtered: string[] = [];
    for (const paragraph of paragraphs) {
      const key = normalize(paragraph).slice(0, 240);
      if (key.length > 48 && seen.has(key)) continue;
      if (key.length > 48) seen.add(key);
      filtered.push(paragraph);
    }
    return filtered.join("\n\n").trim();
  }

  reduce(text: string) {
    return this.apply(text);
  }
}
