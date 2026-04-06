import type { ConstraintMapping, LogicalDiscernmentInput } from "./logical-discernment-types";
import { normalizeLogicalText, toUnique } from "./logical-discernment-utils";

export function mapConstraints(input: LogicalDiscernmentInput): ConstraintMapping {
  const normalized = normalizeLogicalText(input.normalizedMessage || input.message);
  if (!normalized) return { constraints: [], evidence: ["empty_prompt"] };

  const constraints: string[] = [];
  if (/\b(recursos limitados|orcamento limitado|or[cç]amento limitado|gastar menos|baixo custo|economizar)\b/.test(normalized)) {
    constraints.push("restricao_orcamentaria");
  }
  if (/\b(sem excecao|sem excecoes|obrigatorio|obrigatoria|obrigatorios|obrigatorias)\b/.test(normalized)) {
    constraints.push("restricao_normativa_estrita");
  }
  if (/\b(em menos de|menos de \d+\s*(min|mins|minutos|h|hora|horas)|prazo|urgente)\b/.test(normalized)) {
    constraints.push("restricao_tempo");
  }
  if (/\b(no posto|ao lado da casa|local fixo|neste local|nesse local|mesmo lugar)\b/.test(normalized)) {
    constraints.push("restricao_localizacao");
  }
  if (/\b(nao reduzir liberdade|nao pode reduzir liberdade|liberdade basica)\b/.test(normalized)) {
    constraints.push("restricao_liberdade_basica");
  }
  if (/\b(maximizar o bem estar agregado|bem estar agregado)\b/.test(normalized)) {
    constraints.push("restricao_bem_estar_agregado");
  }
  if (/\b(regra universal|sem excecao)\b/.test(normalized)) {
    constraints.push("restricao_universalizacao");
  }
  if (/\b(seguranca|risco)\b/.test(normalized)) {
    constraints.push("restricao_seguranca");
  }

  const numericTime = normalized.match(/\b(\d+)\s*(min|minutos|h|hora|horas)\b/);
  if (numericTime) {
    constraints.push(`limite_tempo_explicito:${numericTime[1]}_${numericTime[2]}`);
  }

  return {
    constraints: toUnique(constraints, 12),
    evidence: constraints.length ? ["constraint_signals_detected"] : ["no_strict_constraints_detected"],
  };
}

