/**
 * @file profile-selector.ts
 * @description Seleciona perfis de execucao a partir da decisao fundida e da natureza cognitiva.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Escolher regimes de descida coerentes sem criar um roteador externo ao pipeline.
 * @inputs Texto normalizado, FusedRoutingDecision e TaskNatureState opcional.
 * @outputs Lista ordenada de ids de perfil.
 * @dependsOn routing-analysis-types, task-nature-state, profile-priority-rules.
 * @usedBy orchestration-layer-bridge e execution-profile-selector.
 * @invariants A selecao e declarativa; perfis modulam camadas, nao pulam a descida.
 * @notes Mantem heuristicas textuais auditaveis e prioriza a classificacao cognitiva quando presente.
 */
import type { TaskNatureState } from "../../bridges/contracts/task-nature-state";
import type { FusedRoutingDecision } from "../llm-routing/routing-analysis-types";
import { sortProfileIdsByPriority } from "./profile-priority-rules";

export interface ProfileSelectorInput {
  normalizedMessage: string;
  fusedDecision: FusedRoutingDecision;
  taskNatureState?: TaskNatureState;
}

function pushProfileForTaskNature(profileIds: string[], taskNatureState: TaskNatureState | undefined): void {
  switch (taskNatureState?.selectedTaskType) {
    case "greeting_light":
      profileIds.push("greeting-profile");
      break;
    case "conversational_light":
      profileIds.push("conversational-light-profile");
      break;
    case "pedagogical_explanation":
      profileIds.push("pedagogical-explanation-profile");
      break;
    case "technical_analysis":
      profileIds.push("technical-analysis-profile");
      break;
    case "dialectical_counterargument":
      profileIds.push("dialectical-counterargument-profile");
      break;
    case "closed_constraint_deduction":
      profileIds.push("closed-constraint-deduction-profile");
      break;
    case "short_deterministic_reasoning":
      profileIds.push("short-deterministic-reasoning-profile");
      break;
    case "procedural_instruction":
      profileIds.push("procedural-instruction-profile");
      break;
    case "retrieval_grounded_analysis":
      profileIds.push("retrieval-grounded-analysis-profile");
      break;
    case "debug_and_correction":
      profileIds.push("debug-correction-profile");
      break;
    case "academic_normalization":
      profileIds.push("academic-normalization-profile");
      break;
    case "reflective_comparison":
      profileIds.push("reflective-comparison-profile");
      break;
    case "decision_between_alternatives":
      profileIds.push("decision-support-profile");
      break;
    case "open_exploration":
      profileIds.push("open-exploration-profile");
      break;
    case "structured_synthesis":
      profileIds.push("summary-synthesis-profile");
      break;
    default:
      break;
  }
}

export function selectExecutionProfileIds(input: ProfileSelectorInput): string[] {
  const text = input.normalizedMessage.toLowerCase();
  const fused = input.fusedDecision;
  const profileIds = [...fused.recommendedProfiles];

  pushProfileForTaskNature(profileIds, input.taskNatureState);

  if (/\b(oi|ola|ol[aá]|bom dia|boa tarde|boa noite|hello|hi)\b/.test(text) && fused.finalComplexityScore < 0.24) {
    profileIds.push("greeting-profile");
  }
  if (/\b(auditoria|arquitetur|pipeline|contrato adaptativo)\b/.test(text) || fused.taskType.includes("audit")) {
    profileIds.push("architecture-audit-profile");
  }
  if (/\b(implemente|implement|refator|patch|arquivo|repositorio|repo|typescript|ts)\b/.test(text)) {
    profileIds.push("technical-implementation-profile");
  }
  if (/\b(analise|an[aá]lise|arquitetura|sistema|c[oó]digo|codigo)\b/.test(text)) {
    profileIds.push("technical-analysis-profile");
  }
  if (/\b(debug|corrig|falha|erro|bug|quebra|cortad|truncad|unavailable)\b/.test(text)) {
    profileIds.push("debug-correction-profile");
  }
  if (/\b(resuma|sintetize|sumario|sum[aá]rio|resumo|sintese|s[ií]ntese|consolide|organize)\b/.test(text)) {
    profileIds.push("summary-synthesis-profile");
  }
  if (/\b(ensine|explique|didaticamente|passo a passo|oriente|por que|como funciona)\b/.test(text) || fused.selectedMode === "teaching") {
    profileIds.push("pedagogical-explanation-profile");
  }
  if (/\b(como fa[cç]o|instru[cç][oõ]es|procedimento|configure|instale|passos|guia)\b/.test(text)) {
    profileIds.push("procedural-instruction-profile");
  }
  if (/\b(redija|escreva|componha|texto)\b/.test(text) || fused.selectedMode === "writing") {
    profileIds.push("writing-composition-profile");
  }
  if (/\b(citacao|cita[cç][aã]o|abnt|apa|academico|acad[eê]mico)\b/.test(text)) {
    profileIds.push("academic-normalization-profile");
  }
  if (fused.retrievalNeed === "standard" || fused.retrievalNeed === "heavy") {
    profileIds.push("retrieval-augmented-profile");
  }
  if (/\b(fontes|cita[cç][oõ]es|pesquise|busque|verifique|recente|latest|documenta[cç][aã]o)\b/.test(text)) {
    profileIds.push("retrieval-grounded-analysis-profile");
  }
  if (fused.reflectionNeed === "heavy") {
    profileIds.push("reflective-comparison-profile");
  }
  if (fused.validationNeed === "heavy" || fused.riskLevel === "high") {
    profileIds.push("high-caution-validation-profile");
  }
  if (fused.memoryNeed === "heavy") {
    profileIds.push("memory-intensive-profile");
  }
  if (/\b(compare|compar|alternativ|trade-off|decida|decis[aã]o|escolha)\b/.test(text)) {
    profileIds.push("decision-support-profile");
  }
  if (/\b(contra-?argument|discorde|conteste|refute|critique|oponha|tese|premissa)\b/.test(text)) {
    profileIds.push("dialectical-counterargument-profile");
  }
  if (/\b(apenas|somente|s[oó]|[úu]nica|unica|restri[cç][aã]o|todas?.*errad|sem olhar|pode tirar|deduz|l[oó]gica)\b/.test(text)) {
    profileIds.push("closed-constraint-deduction-profile");
  }
  if (/\b(responda direto|curto e grosso|s[oó] diga|qual [eé]|quanto [eé]|calcule)\b/.test(text)) {
    profileIds.push("short-deterministic-reasoning-profile");
  }
  if (/\b(nao |n[aã]o |deve|obrigatorio|obrigat[oó]rio|restricao|restri[cç][aã]o|must|cannot)\b/.test(text)) {
    profileIds.push("constraint-heavy-instruction-profile");
  }
  if (/\b(translate|traduz|english|espanol|espa[nñ]ol|multiling)\b/.test(text)) {
    profileIds.push("multilingual-alignment-profile");
  }
  if (/\b(explore|brainstorm|possibilidades|ideias|hip[oó]teses|investigue)\b/.test(text)) {
    profileIds.push("open-exploration-profile");
  }
  if (!profileIds.length) {
    profileIds.push(fused.finalComplexityScore >= 0.55 ? "conversational-deep-profile" : "conversational-light-profile");
  }

  return sortProfileIdsByPriority(profileIds).slice(0, 4);
}

