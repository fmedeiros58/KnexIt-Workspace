/**
 * Responsabilidade do arquivo:
 * - Expandir consultas por rodada (exploracao, focalizacao, confirmacao, contraste).
 * - Introduzir variacoes semanticas controladas para reduzir ruído.
 * - Produzir consultas uteis sem aleatoriedade descontrolada.
 */
import { textNormalizationService } from "../../shared/text-processing/text-normalization.service";
import type { QueryDecomposition, SearchRoundKind } from "./iterative-acquisition-types";

function unique(values: string[], max = 16): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const row of values) {
    const normalized = row.trim();
    if (!normalized) continue;
    const fingerprint = textNormalizationService.fingerprint(normalized);
    if (!fingerprint || seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    output.push(normalized);
    if (output.length >= max) break;
  }
  return output;
}

export function expandQueriesByRound(
  decomposition: QueryDecomposition,
  round: SearchRoundKind,
  maxQueries = 10,
): string[] {
  const base = decomposition.centralQuestion;
  const required = decomposition.requiredTerms.join(" ");
  const entityLine = decomposition.entities.join(" ");
  const helper = decomposition.helperQuestions.slice(0, 2);

  const semanticVariants = textNormalizationService.variants(base, "retrieval", {
    maxVariants: 5,
    maxInputLength: 280,
  });

  if (round === "exploration") {
    return unique(
      [
        base,
        ...decomposition.subQueries,
        ...semanticVariants,
        required ? `${required} panorama` : "",
        entityLine ? `${entityLine} referencia` : "",
      ],
      maxQueries,
    );
  }

  if (round === "focalization") {
    return unique(
      [
        base,
        required ? `${required} fonte oficial` : "",
        required ? `${required} definicao precisa` : "",
        ...decomposition.subQueries.slice(0, 2),
      ],
      maxQueries,
    );
  }

  if (round === "confirmation") {
    return unique(
      [
        base,
        required ? `${required} confirmacao independente` : "",
        helper[0] || "",
        `${base} site:gov`,
      ],
      maxQueries,
    );
  }

  return unique(
    [
      base,
      required ? `${required} controversia` : "",
      helper[1] || "",
      `${base} contradicao`,
      `${base} desatualizado`,
    ],
    maxQueries,
  );
}

