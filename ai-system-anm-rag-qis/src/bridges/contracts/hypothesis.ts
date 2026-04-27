/**
 * @file hypothesis.ts
 * @description Define uma hipotese cognitiva ou interpretativa em competicao.
 * @layer bridges/contracts
 * @purpose Apoiar competicao de interpretacoes sem travar o pipeline descendente.
 * @inputs Leitura do enunciado, sinais de contexto, evidencias e operadores de QIS.
 * @outputs Hypothesis.
 * @dependsOn evidence-unit.
 * @usedBy camada de estado de informacao, inferencia, integracao epistemica e auditoria.
 * @invariants Hipoteses devem ser distinguiveis e possuir score auditavel.
 * @notes Este contrato complementa, mas nao substitui, os tipos legados de hypothesisSet.
 */
import type { EvidenceUnit } from "./evidence-unit";

export interface Hypothesis {
  id: string;
  label: string;
  statement: string;
  score: number;
  evidence: EvidenceUnit[];
  assumptions: string[];
  risks: string[];
}

