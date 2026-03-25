/**
 * Responsabilidade do arquivo:
 * - Detectar entidades explicitas de superficie (arquivos, layers, nomes citados entre aspas).
 * - Fornecer entidades sem inferencia externa/contextual.
 * - Apoiar desambiguacao de escopo local.
 */
import { dedupeList } from "../utils/normalization-utils";

export interface EntitySurfaceExtractorInput {
  text: string;
}

export interface EntitySurfaceExtractorResult {
  entities: string[];
}

export function entitySurfaceExtractor(input: EntitySurfaceExtractorInput): EntitySurfaceExtractorResult {
  const text = `${input.text || ""}`;
  const quoted = [...text.matchAll(/"([^"]{2,})"|'([^']{2,})'/g)].map((match) => (match[1] || match[2] || "").trim());
  const fileLike = [...text.matchAll(/\b[a-z0-9._-]+\.(ts|js|md|json|yaml|yml)\b/gi)].map((match) => match[0]);
  const layerLike = [...text.matchAll(/\b\d{2}-[a-z0-9-]+\b/gi)].map((match) => match[0]);

  return {
    entities: dedupeList([...quoted, ...fileLike, ...layerLike]).slice(0, 24),
  };
}

