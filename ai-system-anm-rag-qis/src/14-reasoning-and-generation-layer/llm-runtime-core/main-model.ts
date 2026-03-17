export function selectMainModel(preferred = "mistral-awq"): string {
  return preferred || "mistral-awq";
}
