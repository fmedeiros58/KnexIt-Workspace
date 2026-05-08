/**
 * @file commitment-ledger.ts
 * @description Define o livro de compromissos argumentativos e operacionais da conversa.
 * @layer bridges/contracts
 * @purpose Registrar compromissos assumidos, contestados ou pendentes entre turnos.
 * @inputs Atos dialogicos, respostas anteriores e operadores de contexto.
 * @outputs CommitmentLedger e CommitmentEntry.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy operadores de continuidade, validadores dialogicos e auditoria.
 * @invariants Compromissos devem ser rastreados como estado, nao como fatos finais.
 * @notes A estrutura e propositalmente simples para evitar acoplamento com memoria persistente.
 */
export interface CommitmentEntry {
  id: string;
  owner: "user" | "assistant" | "system";
  statement: string;
  status: "open" | "accepted" | "challenged" | "resolved" | "withdrawn";
  evidenceRefs: string[];
}

export interface CommitmentLedger {
  entries: CommitmentEntry[];
  unresolvedCount: number;
  auditReasons: string[];
}

