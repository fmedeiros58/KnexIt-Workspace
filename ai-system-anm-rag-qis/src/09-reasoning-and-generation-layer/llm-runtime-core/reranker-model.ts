export function selectRerankerModel(preferred = "reranker-local"): string {
  return preferred || "reranker-local";
}
