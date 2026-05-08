/**
 * @file commitment-ledger-updater.ts
 * @description Atualiza compromissos argumentativos simples da sessao.
 * @layer 04-context-and-session-layer
 * @purpose Registrar teses ou tarefas assumidas para continuidade e auditoria.
 * @inputs Ledger anterior, dono e novo enunciado.
 * @outputs CommitmentLedger atualizado.
 * @dependsOn commitment-ledger.
 * @usedBy contexto e validacao dialogica.
 * @invariants Entradas devem ser append-only e status inicial open.
 * @notes IDs sao deterministas por tamanho/ordem local.
 */
import type { CommitmentLedger } from "../../bridges/contracts/commitment-ledger";

export function updateCommitmentLedger(
  ledger: CommitmentLedger | null | undefined,
  owner: "user" | "assistant" | "system",
  statement: string,
): CommitmentLedger {
  const entries = [...(ledger?.entries || [])];
  if (statement.trim()) {
    entries.push({
      id: `commitment-${entries.length + 1}`,
      owner,
      statement: statement.trim().slice(0, 240),
      status: "open",
      evidenceRefs: [],
    });
  }
  return {
    entries: entries.slice(-24),
    unresolvedCount: entries.filter((entry) => entry.status === "open" || entry.status === "challenged").length,
    auditReasons: [`owner:${owner}`, `entries:${entries.length}`],
  };
}

