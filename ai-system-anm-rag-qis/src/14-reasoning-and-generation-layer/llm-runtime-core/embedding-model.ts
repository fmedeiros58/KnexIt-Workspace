export function selectEmbeddingModel(preferred = "intfloat/multilingual-e5-base"): string {
  return preferred || "intfloat/multilingual-e5-base";
}
