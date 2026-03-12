import type { LeticiaMemoryCandidate } from "../types";
import { compactWhitespace, normalizeForMatch } from "../utils/text";

function makeCandidate(candidate: LeticiaMemoryCandidate) {
  return {
    ...candidate,
    candidateText: compactWhitespace(candidate.candidateText),
  };
}

export class LeticiaMemoryExtractorService {
  extractFromUserText(text: string) {
    const source = compactWhitespace(text);
    const normalized = normalizeForMatch(source);
    const candidates: LeticiaMemoryCandidate[] = [];

    const nameMatch = source.match(
      /\b(?:meu nome e|eu sou|my name is|soy)\s+([A-Za-zÀ-ÿ' -]{2,80}?)(?=(?:\s+e\s+eu\b|[,.!?]|$))/i,
    );
    if (nameMatch?.[1]) {
      const rawName = compactWhitespace(nameMatch[1]);
      candidates.push(
        makeCandidate({
          memoryKind: "identity",
          candidateText: `Nome informado: ${rawName}`,
          normalizedValue: normalizeForMatch(rawName),
          confidence: 0.92,
          metadata: { field: "name", value: rawName },
        }),
      );
    }

    const preferencePatterns = [
      /\b(eu gosto de|i like|me gusta)\s+(.{2,120})$/i,
      /\b(minha comida favorita e|minha cor favorita e|my favorite .* is)\s+(.{2,120})$/i,
    ];
    for (const pattern of preferencePatterns) {
      const match = source.match(pattern);
      if (!match?.[2]) continue;
      const value = compactWhitespace(match[2]);
      candidates.push(
        makeCandidate({
          memoryKind: "preference",
          candidateText: `Preferencia declarada: ${value}`,
          normalizedValue: normalizeForMatch(value),
          confidence: 0.8,
          metadata: { field: "preference", value },
        }),
      );
      break;
    }

    const workMatch = source.match(/\b(trabalho (na|no|em)|eu trabalho (na|no|em)|i work at)\s+(.{2,120})$/i);
    if (workMatch?.[4]) {
      const value = compactWhitespace(workMatch[4]);
      candidates.push(
        makeCandidate({
          memoryKind: "fact",
          candidateText: `Vinculo profissional declarado: ${value}`,
          normalizedValue: `work:${normalizeForMatch(value)}`,
          confidence: 0.82,
          metadata: { field: "workplace", value },
        }),
      );
    }

    const relationPatterns: Array<{ pattern: RegExp; relationType: string }> = [
      { pattern: /\b(meu amigo e|minha amiga e|sou amigo de|sou amiga de)\s+(.{2,120})$/i, relationType: "friend" },
      { pattern: /\b(minha esposa e|meu marido e)\s+(.{2,120})$/i, relationType: "spouse" },
      { pattern: /\b(meu filho e|minha filha e)\s+(.{2,120})$/i, relationType: "family" },
    ];
    for (const entry of relationPatterns) {
      const match = source.match(entry.pattern);
      if (!match?.[2]) continue;
      const targetName = compactWhitespace(match[2]);
      candidates.push(
        makeCandidate({
          memoryKind: "relationship",
          candidateText: `${entry.relationType}:${targetName}`,
          normalizedValue: `${entry.relationType}:${normalizeForMatch(targetName)}`,
          confidence: 0.86,
          metadata: {
            relationType: entry.relationType,
            targetName,
          },
        }),
      );
      break;
    }

    return candidates;
  }
}
