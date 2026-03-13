export function getSystemKnowledgeHints(query: string): string[] {
  const hints = [
    "Conectar resposta ao contexto ativo da conversa.",
    "Explicitar status epistemico no fechamento.",
  ];
  if (/atual|hoje|presidente|governador|prefeito/i.test(query)) {
    hints.push("Pergunta sensivel a recencia: privilegiar sinais de atualizacao.");
  }
  if (/compar|versus|vs|tradeoff/i.test(query)) {
    hints.push("Pergunta comparativa: explicitar criterios de decisao.");
  }
  return hints;
}
