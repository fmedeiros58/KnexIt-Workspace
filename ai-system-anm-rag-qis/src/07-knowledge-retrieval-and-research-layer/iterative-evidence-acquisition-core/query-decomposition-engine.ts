/**
 * Responsabilidade do arquivo:
 * - Decompor consulta em pergunta central, subconsultas e entidades.
 * - Destacar termos obrigatorios/opcionais para busca iterativa.
 * - Gerar perguntas auxiliares para rounds posteriores.
 */
import { normalizeWhitespace } from "../../shared/utils/text-utils";
import type { QueryDecomposition } from "./iterative-acquisition-types";

function tokenize(value: string): string[] {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function unique(values: string[], max = 12): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    output.push(value);
    if (output.length >= max) break;
  }
  return output;
}

export function decomposeQuery(query: string): QueryDecomposition {
  const centralQuestion = normalizeWhitespace(query);
  const tokens = tokenize(query);
  const entities = unique(tokens.filter((token) => token.length >= 4), 8);

  const stopwords = new Set([
    "qual",
    "quais",
    "como",
    "porque",
    "por",
    "que",
    "de",
    "do",
    "da",
    "dos",
    "das",
    "para",
    "com",
    "sobre",
    "em",
    "na",
    "no",
  ]);

  const requiredTerms = unique(tokens.filter((token) => token.length >= 3 && !stopwords.has(token)), 10);
  const optionalTerms = unique(tokens.filter((token) => token.length === 2), 6);

  const subQueries: string[] = [];
  if (requiredTerms.length >= 2) {
    subQueries.push(`${requiredTerms.slice(0, 2).join(" ")} contexto oficial`);
  }
  if (requiredTerms.length >= 3) {
    subQueries.push(`${requiredTerms.slice(0, 3).join(" ")} dados atualizados`);
  }
  if (entities.length >= 1) {
    subQueries.push(`${entities[0]} fonte primaria`);
  }

  const helperQuestions = [
    "Qual fonte oficial confirma o dado central?",
    "Existe divergencia entre fontes independentes?",
    "O dado esta atualizado para o contexto temporal atual?",
  ];

  return {
    centralQuestion,
    subQueries: unique(subQueries, 6),
    entities,
    requiredTerms,
    optionalTerms,
    exclusions: [],
    helperQuestions,
  };
}

