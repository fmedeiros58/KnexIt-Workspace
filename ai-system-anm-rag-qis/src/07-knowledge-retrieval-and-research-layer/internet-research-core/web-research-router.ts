export function shouldUseWebResearch(input: {
  query: string;
  localSourceCount: number;
  verifiable: boolean;
  conversationalPrompt?: boolean;
}): boolean {
  const normalizedQuery = `${input.query || ""}`.trim();
  if (!normalizedQuery) return false;
  // Fast lane para saudações/conversa curta: nao bloquear resposta basica com I/O web.
  if (input.conversationalPrompt) return false;
  // Fora disso, mantemos verificacao web ativa para consultas textuais.
  return true;
}
