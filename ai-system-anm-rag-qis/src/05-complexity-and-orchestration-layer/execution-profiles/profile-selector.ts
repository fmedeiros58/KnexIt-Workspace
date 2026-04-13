/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/profile-selector
 * Responsibility: Select candidate execution profiles from the fused routing decision.
 * Primary Inputs: Normalized request text and fused routing decision.
 * Primary Outputs: Ordered profile ids.
 * Upstream Dependencies: profile-priority-rules
 * Downstream Dependencies: profile-composer, orchestration-layer
 * Invariants: Selection remains hybrid and deterministic; it does not replace route policy.
 * Failure Modes: Empty selection falls back to conversational-light-profile.
 * Audit Events: profile_candidates_selected
 * Notes: The selector uses both fused signals and direct textual cues for robustness.
 */
import type { FusedRoutingDecision } from "../llm-routing/routing-analysis-types";
import { sortProfileIdsByPriority } from "./profile-priority-rules";

export interface ProfileSelectorInput {
  normalizedMessage: string;
  fusedDecision: FusedRoutingDecision;
}

export function selectExecutionProfileIds(input: ProfileSelectorInput): string[] {
  const text = input.normalizedMessage.toLowerCase();
  const fused = input.fusedDecision;
  const profileIds = [...fused.recommendedProfiles];

  if (/\b(oi|ola|olá|bom dia|boa tarde|boa noite|hello|hi)\b/.test(text) && fused.finalComplexityScore < 0.24) {
    profileIds.push("greeting-profile");
  }
  if (/\b(auditoria|arquitetur|pipeline|contrato adaptativo)\b/.test(text) || fused.taskType.includes("audit")) {
    profileIds.push("architecture-audit-profile");
  }
  if (/\b(implemente|implement|refator|patch|arquivo|repositorio|repo|typescript|ts)\b/.test(text)) {
    profileIds.push("technical-implementation-profile");
  }
  if (/\b(debug|corrig|falha|erro|bug|quebra)\b/.test(text)) {
    profileIds.push("debug-correction-profile");
  }
  if (/\b(resuma|sintetize|sumario|resumo|sintese)\b/.test(text)) {
    profileIds.push("summary-synthesis-profile");
  }
  if (/\b(ensine|explique didaticamente|passo a passo|oriente)\b/.test(text) || fused.selectedMode === "teaching") {
    profileIds.push("teaching-guidance-profile");
  }
  if (/\b(redija|escreva|componha|texto)\b/.test(text) || fused.selectedMode === "writing") {
    profileIds.push("writing-composition-profile");
  }
  if (/\b(citacao|citação|abnt|apa|academico|acadêmico)\b/.test(text)) {
    profileIds.push("academic-normalization-profile");
  }
  if (fused.retrievalNeed === "standard" || fused.retrievalNeed === "heavy") {
    profileIds.push("retrieval-augmented-profile");
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
  if (/\b(compare|compar|alternativ|trade-off|decida|decisao|decisão|escolha)\b/.test(text)) {
    profileIds.push("decision-support-profile");
  }
  if (/\b(nao |não |deve|obrigatorio|obrigatório|restricao|restrição|must|cannot)\b/.test(text)) {
    profileIds.push("constraint-heavy-instruction-profile");
  }
  if (/\b(translate|traduz|english|espanol|español|multiling)\b/.test(text)) {
    profileIds.push("multilingual-alignment-profile");
  }
  if (!profileIds.length) {
    profileIds.push(fused.finalComplexityScore >= 0.55 ? "conversational-deep-profile" : "conversational-light-profile");
  }

  return sortProfileIdsByPriority(profileIds).slice(0, 4);
}
