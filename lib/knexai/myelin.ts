export type Turn = { role: "user"|"assistant"|"system"; content: string };

export function compactHistory(turns: Turn[], budgetChars = 4000) {
  // junta blocos estáveis em um “anchor” e retém últimos passos detalhados
  const stable = [];
  const recent = [];
  let size = 0;

  // últimos N passos como “recent”
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (size + t.content.length < Math.floor(budgetChars * 0.6)) {
      recent.unshift(t);
      size += t.content.length;
    } else {
      stable.unshift(t);
    }
  }

  const anchor = summarizeStable(stable.join("\n"), Math.floor(budgetChars * 0.4));
  return { anchor, recent };
}

function summarizeStable(text: string, maxLen: number) {
  if (!text) return "";
  // Heurística simples: corta e marca como “âncora estável”.
  // Pode evoluir: resumir com o próprio modelo local, offline.
  const t = text.replace(/\s+/g, " ").slice(0, maxLen);
  return `ÂNCORA ESTÁVEL:\n${t}${t.length >= maxLen ? "..." : ""}`;
}

export function buildMyelinatedPrompt(system: string, anchor: string, recent: Turn[], userInput: string) {
  const lines = [
    `[SISTEMA]\n${system}`,
    anchor ? `\n[CONTEXTO ESTÁVEL]\n${anchor}` : "",
    `\n[HISTÓRICO RECENTE]\n${recent.map(t => `(${t.role}) ${t.content}`).join("\n")}`,
    `\n[USUÁRIO]\n${userInput}\n\n[ASSISTENTE]`,
  ];
  return lines.join("\n");
}
