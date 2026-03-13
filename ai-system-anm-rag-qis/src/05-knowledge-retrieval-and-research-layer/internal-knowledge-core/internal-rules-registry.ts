export function getInternalRules(intent: string): string[] {
  const normalized = intent.trim().toLowerCase();
  const base = ["Evitar afirmacoes absolutas sem evidencia.", "Priorizar explicitude de incerteza quando aplicavel."];
  if (normalized === "question") return [...base, "Responder de forma verificavel e direta."];
  if (normalized === "writing") return [...base, "Priorizar clareza estrutural e progressao logica."];
  if (normalized === "summary") return [...base, "Preservar pontos criticos com concisao."];
  return base;
}
