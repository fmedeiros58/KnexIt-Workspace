/**
 * Responsabilidade do arquivo:
 * - Detectar lacunas de memoria com alto valor funcional e baixa invasividade.
 * - Priorizar preferencias e contexto recorrente que melhoram respostas futuras.
 * - Evitar oportunidades curiosas sem ganho operacional real.
 */
import type {
  BehaviorPersonalityInput,
  ProactiveMemoryOpportunityType,
} from "./behavior-and-personality-types";

export interface MemoryOpportunityDetection {
  opportunityType: ProactiveMemoryOpportunityType;
  memoryValueScore: number;
  futureUtilityScore: number;
  intrusivenessBaseScore: number;
  rationale: string;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyPreference(input: BehaviorPersonalityInput): boolean {
  const prefs = input.userExplicitPreference || {};
  return (
    Number.isFinite(Number(prefs.preferredWarmth)) ||
    Number.isFinite(Number(prefs.preferredCasualness)) ||
    Number.isFinite(Number(prefs.preferredEmpathy)) ||
    Number.isFinite(Number(prefs.preferredFormality)) ||
    prefs.preferDirectStyle === true ||
    prefs.preferShortReplies === true
  );
}

function detectOpportunityType(input: BehaviorPersonalityInput): ProactiveMemoryOpportunityType {
  const message = normalize(input.contextualSignals.normalizedMessage || "");
  const hasPreference = hasAnyPreference(input);

  if (!hasPreference && input.interactionType === "follow_up") return "style_preference";
  if (!hasPreference && /\b(responda|resposta|tom|estilo|objetivo|detalhado|direto)\b/.test(message)) return "detail_level";
  if (!/\b(formato|lista|topico|paragrafo|markdown|tabela)\b/.test(message) && input.taskType === "technical") {
    return "format_preference";
  }
  if (!/\b(projeto|cliente|produto|sistema|fluxo|pipeline)\b/.test(message) && input.interactionType === "follow_up") {
    return "recurring_goal";
  }
  if (!/\b(academico|tecnico|operacional|estudo|trabalho|publicacao)\b/.test(message) && input.taskType === "analytical") {
    return "usage_context";
  }
  if (!/\b(restricao|limite|nao usar|evitar)\b/.test(message) && input.interactionType === "clarification") {
    return "constraint_preference";
  }
  return "none";
}

function scoreByOpportunity(type: ProactiveMemoryOpportunityType) {
  if (type === "style_preference") return { memory: 0.78, future: 0.74, intrusiveness: 0.22 };
  if (type === "detail_level") return { memory: 0.72, future: 0.78, intrusiveness: 0.2 };
  if (type === "format_preference") return { memory: 0.68, future: 0.72, intrusiveness: 0.18 };
  if (type === "recurring_goal") return { memory: 0.76, future: 0.8, intrusiveness: 0.24 };
  if (type === "usage_context") return { memory: 0.66, future: 0.7, intrusiveness: 0.22 };
  if (type === "constraint_preference") return { memory: 0.7, future: 0.74, intrusiveness: 0.18 };
  return { memory: 0.08, future: 0.1, intrusiveness: 0.05 };
}

export function detectMemoryOpportunity(input: BehaviorPersonalityInput): MemoryOpportunityDetection {
  const opportunityType = detectOpportunityType(input);
  const base = scoreByOpportunity(opportunityType);
  const sensitivityPenalty =
    input.sensitivityLevel === "critical"
      ? 0.42
      : input.sensitivityLevel === "high"
        ? 0.3
        : input.sensitivityLevel === "medium"
          ? 0.14
          : 0;
  const directPreferencePenalty = input.userExplicitPreference?.preferDirectStyle ? 0.16 : 0;
  const frustrationBoost = clamp01(input.frustrationSignal) * 0.1;
  const continuityBoost = clamp01(input.contextualSignals.continuityScore ?? 0.4) * 0.08;

  const memoryValueScore = clamp01(base.memory + continuityBoost - (sensitivityPenalty * 0.2));
  const futureUtilityScore = clamp01(base.future + frustrationBoost + continuityBoost - (sensitivityPenalty * 0.22));
  const intrusivenessBaseScore = clamp01(base.intrusiveness + sensitivityPenalty + directPreferencePenalty);

  const rationale =
    opportunityType === "none"
      ? "sem_lacuna_funcional_relevante_para_memoria"
      : `lacuna_detectada:${opportunityType}`;

  return {
    opportunityType,
    memoryValueScore,
    futureUtilityScore,
    intrusivenessBaseScore,
    rationale,
  };
}

