/** ai-system-anm */
function normalize(text: string) {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function mapResponseIntent(text: string): "direct" | "explanatory" | "comparative" | "stepwise" | "clarifying" {
  const normalized = normalize(text);
  if (/\b(entre|compar|versus|vs|melhor)\b/.test(normalized)) return "comparative";
  if (/\b(passo a passo|etapas|como faco|como fazer)\b/.test(normalized)) return "stepwise";
  if (/\b(explique|detalhe|aprofunde|por que|porque)\b/.test(normalized)) return "explanatory";
  if (/\b(nao entendi|pode esclarecer|pode clarificar|duvida)\b/.test(normalized)) return "clarifying";
  return "direct";
}
