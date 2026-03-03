import { loadVectorDatabaseConfig } from "../config/env";

export type VectorSearchParamsInput = {
  topK?: number;
  maxDistance?: number | null;
};

export type VectorSearchParams = {
  topK: number;
  maxDistance: number | null;
  strategy: "cosine";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function resolveVectorSearchParams(
  input: VectorSearchParamsInput = {},
  rawEnv: NodeJS.ProcessEnv = process.env,
): VectorSearchParams {
  const config = loadVectorDatabaseConfig(rawEnv);
  const fallbackTopK = clamp(config.searchTopKDefault, 1, config.searchTopKMax);
  const resolvedTopK = Number.isFinite(input.topK as number)
    ? clamp(Math.round(input.topK as number), 1, config.searchTopKMax)
    : fallbackTopK;

  const explicitMaxDistance = input.maxDistance;
  const resolvedMaxDistance =
    typeof explicitMaxDistance === "number" && Number.isFinite(explicitMaxDistance)
      ? explicitMaxDistance
      : config.searchMaxDistanceDefault;

  return {
    topK: resolvedTopK,
    maxDistance: resolvedMaxDistance ?? null,
    strategy: config.distanceStrategy,
  };
}
