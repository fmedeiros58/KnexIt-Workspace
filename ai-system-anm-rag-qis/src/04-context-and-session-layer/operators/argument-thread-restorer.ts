/**
 * @file argument-thread-restorer.ts
 * @description Restaura uma trilha argumentativa compacta a partir de contexto recente.
 * @layer 04-context-and-session-layer
 * @purpose Apoiar continuidade de teses, objecoes e conclusoes pendentes.
 * @inputs Turnos recentes da conversa.
 * @outputs Lista de marcadores de thread argumentativa.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy contexto, operadores inferenciais e auditoria.
 * @invariants Nao deve inferir teses fortes sem sinal textual.
 * @notes Preserva apenas marcadores curtos para evitar poluir contexto.
 */
export function restoreArgumentThread(turns: Array<{ role: "user" | "assistant"; content: string }>): string[] {
  return turns
    .slice(-8)
    .filter((turn) => /\b(tese|premissa|porque|portanto|discordo|objec[aã]o|conclus[aã]o)\b/i.test(turn.content))
    .map((turn) => `${turn.role}:${turn.content.replace(/\s+/g, " ").trim().slice(0, 140)}`)
    .slice(-8);
}

