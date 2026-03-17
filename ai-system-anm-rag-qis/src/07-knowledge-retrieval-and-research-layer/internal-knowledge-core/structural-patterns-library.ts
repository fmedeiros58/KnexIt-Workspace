export function getStructuralPatterns(intent: string): string[] {
  const normalized = intent.trim().toLowerCase();
  if (normalized === "question") return ["resposta direta", "justificativa curta", "fontes"]; 
  if (normalized === "writing") return ["abertura", "desenvolvimento", "fechamento"]; 
  return ["contexto", "analise", "conclusao"]; 
}
