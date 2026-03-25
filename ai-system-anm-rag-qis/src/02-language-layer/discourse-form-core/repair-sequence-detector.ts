/**
 * Responsabilidade do arquivo:
 * - Detectar sequencias de autorreparo (correcao dentro do mesmo turno).
 * - Classificar reparo em tipos simples para handoff linguistico.
 * - Gerar sinais auditaveis sem interpretar intencao profunda.
 */
import type { DiscourseRepairSignal } from "../types/language-signal-types";

export interface RepairSequenceDetectorInput {
  text: string;
}

export interface RepairSequenceDetectorResult {
  repairSignals: DiscourseRepairSignal[];
}

export function repairSequenceDetector(input: RepairSequenceDetectorInput): RepairSequenceDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  const repairSignals: DiscourseRepairSignal[] = [];

  for (const match of text.match(/\b(quer dizer|ou melhor|corrigindo|na verdade)\b/g) || []) {
    repairSignals.push({ snippet: match, type: "self-correction" });
  }

  for (const match of text.match(/\b(pera|espera|deixa eu reformular)\b/g) || []) {
    repairSignals.push({ snippet: match, type: "restart" });
  }

  for (const match of text.match(/\b(explico melhor|de forma mais clara|isto e)\b/g) || []) {
    repairSignals.push({ snippet: match, type: "clarification" });
  }

  return {
    repairSignals: repairSignals.slice(0, 12),
  };
}

