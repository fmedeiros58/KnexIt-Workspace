import type { LogicalDiscernmentInput, RealWorldConditionExtraction } from "./logical-discernment-types";
import { normalizeLogicalText, toUnique } from "./logical-discernment-utils";

export function extractRealWorldConditions(input: LogicalDiscernmentInput): RealWorldConditionExtraction {
  const normalized = normalizeLogicalText(input.normalizedMessage || input.message);
  if (!normalized) return { conditions: [], evidence: ["empty_prompt"] };

  const conditions: string[] = [];
  if (/\b(posto fica ao lado|ao lado da casa|perto de casa|distancia curta)\b/.test(normalized)) {
    conditions.push("deslocamento_curto_disponivel");
  }
  if (/\b(deslocamento ja necessario|ja vou passar|rota ja prevista)\b/.test(normalized)) {
    conditions.push("deslocamento_base_ja_existente");
  }
  if (/\b(tarde da noite|de noite|a noite|noite)\b/.test(normalized)) {
    conditions.push("janela_noturna");
  }
  if (/\b(voltar para casa)\b/.test(normalized)) {
    conditions.push("objetivo_final_retornar_para_casa");
  }
  if (/\b(banco|farmacia|mercado)\b/.test(normalized)) {
    conditions.push("multi_tarefas_urbanas");
  }
  if (/\b(estimados?|nao podem ser medidos com precisao|nao podem ser medidos)\b/.test(normalized)) {
    conditions.push("medicao_apenas_estimativa");
  }
  if (/\b(qualquer decisao possivel viola)\b/.test(normalized)) {
    conditions.push("conflito_normativo_inevitavel");
  }

  return {
    conditions: toUnique(conditions, 12),
    evidence: conditions.length ? ["real_world_conditions_detected"] : ["no_real_world_condition_detected"],
  };
}

