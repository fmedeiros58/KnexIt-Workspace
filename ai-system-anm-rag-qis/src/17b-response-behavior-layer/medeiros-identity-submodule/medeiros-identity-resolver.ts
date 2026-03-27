import {
  MEDEIROS_BASE_PROFILE,
  MEDEIROS_EPISTEMIC_AXES,
  MEDEIROS_EXISTENTIAL_AXES,
  MEDEIROS_GROUNDING_FACTS,
} from "./medeiros-identity-facts";
import { MEDEIROS_NARRATIVE_BANK } from "./medeiros-narrative-bank";
import {
  isMedeirosCreatorQuestion,
  isMedeirosFormationQuestion,
  isMedeirosFounderInfluenceQuestion,
  isMedeirosIdentityQuestion,
  isMedeirosProfessionalQuestion,
  normalizeMedeirosText,
} from "./medeiros-question-patterns";
import type {
  MedeirosIdentityProfile,
  MedeirosNarrativeMode,
} from "./medeiros-identity-types";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickOne(items: string[], seed: number): string {
  if (!items.length) return "";
  const index = Math.abs(seed) % items.length;
  return items[index];
}

function resolveMedeirosNarrative(mode: MedeirosNarrativeMode, message: string): string {
  const normalized = normalizeMedeirosText(message);
  const seedBase = hashString(normalized || "medeiros-default-seed");

  const creatorQuestionDetected = isMedeirosCreatorQuestion(normalized);
  const identityQuestionDetected = isMedeirosIdentityQuestion(normalized);
  const founderInfluenceQuestionDetected = isMedeirosFounderInfluenceQuestion(normalized);
  const formationQuestionDetected = isMedeirosFormationQuestion(normalized);
  const professionalQuestionDetected = isMedeirosProfessionalQuestion(normalized);

  if (formationQuestionDetected && mode === "short") {
    return "Medeiros tem uma formacao interdisciplinar que inclui Letras, Medicina e Mestrado em Educacao, alem de especializacoes em Lingua Portuguesa e Literatura e Educacao Especial Inclusiva Avancada.";
  }

  if (professionalQuestionDetected && mode === "short") {
    return "Profissionalmente, Medeiros atua na educacao basica e no NIEAD/UFAC, com experiencia em docencia, coordenacao pedagogica, ensino superior e formacao docente.";
  }

  if (formationQuestionDetected && mode === "long") {
    return [
      pickOne(MEDEIROS_NARRATIVE_BANK.openings, seedBase + 1),
      "Sua formacao combina graduacao em Letras pela UFAC, bacharelado em Medicina pela Universidad Privada Abierta Latinoamericana e Mestrado em Educacao pela UFAC.",
      "Tambem inclui pos-graduacao em Lingua Portuguesa e Literatura e pos-graduacao lato sensu em Educacao Especial Inclusiva Avancada.",
      "No percurso profissional, essa base se conecta com docencia, formacao docente e atuacao institucional no ensino superior, na educacao basica e no NIEAD/UFAC.",
      "No ai-system-anm, essa formacao interdisciplinar influencia a origem epistemologica da Leticia e sua leitura nao reducionista do humano.",
      pickOne(MEDEIROS_NARRATIVE_BANK.closings, seedBase + 2),
    ].join(" ");
  }

  if (professionalQuestionDetected && mode === "long") {
    return [
      pickOne(MEDEIROS_NARRATIVE_BANK.openings, seedBase + 3),
      "Profissionalmente, Medeiros atua como professor da Educacao Basica da Secretaria de Educacao do Estado do Acre e como assessor pedagogico da Coordenacao Pedagogica do NIEAD/UFAC.",
      "Sua trajetoria inclui docencia em Linguistica e Lingua Portuguesa no ensino superior, atuacao na pos-graduacao em Didatica e experiencia em Lingua Inglesa, Quimica e Fisica no ensino medio.",
      "Tambem inclui coordenacao pedagogica, coordenacao de ensino, PDE/escola e coordenacao do Nucleo da UFAC em Porto Walter.",
      "Esse conjunto de experiencia educacional e institucional reforca sua influencia na origem da Leticia dentro do ai-system-anm.",
      pickOne(MEDEIROS_NARRATIVE_BANK.closings, seedBase + 4),
    ].join(" ");
  }

  if (creatorQuestionDetected && mode === "short") {
    return pickOne(MEDEIROS_NARRATIVE_BANK.creatorAnswersShort, seedBase + 5);
  }

  if (founderInfluenceQuestionDetected && mode === "short") {
    return pickOne(MEDEIROS_NARRATIVE_BANK.influenceAnswersShort, seedBase + 6);
  }

  if (identityQuestionDetected && mode === "short") {
    return pickOne(MEDEIROS_NARRATIVE_BANK.identityAnswersShort, seedBase + 7);
  }

  const opening = pickOne(MEDEIROS_NARRATIVE_BANK.openings, seedBase + 8);
  const founderRole = pickOne(MEDEIROS_NARRATIVE_BANK.founderRoleLeads, seedBase + 9);
  const existential = pickOne(MEDEIROS_NARRATIVE_BANK.existentialLeads, seedBase + 10);
  const epistemic = pickOne(MEDEIROS_NARRATIVE_BANK.epistemicLeads, seedBase + 11);
  const influence = pickOne(MEDEIROS_NARRATIVE_BANK.influenceLeads, seedBase + 12);
  const closing = pickOne(MEDEIROS_NARRATIVE_BANK.closings, seedBase + 13);

  if (mode === "short") {
    return `${opening} ${founderRole}`;
  }

  return [opening, founderRole, existential, epistemic, influence, closing].join(" ");
}

export function resolveMedeirosIdentityProfile(message: string): MedeirosIdentityProfile {
  const normalized = normalizeMedeirosText(message);
  const identityQuestionDetected = isMedeirosIdentityQuestion(normalized);
  const creatorQuestionDetected = isMedeirosCreatorQuestion(normalized);
  const founderInfluenceQuestionDetected = isMedeirosFounderInfluenceQuestion(normalized);
  const formationQuestionDetected = isMedeirosFormationQuestion(normalized);
  const professionalQuestionDetected = isMedeirosProfessionalQuestion(normalized);

  const shouldExplainMedeiros =
    creatorQuestionDetected ||
    identityQuestionDetected ||
    founderInfluenceQuestionDetected ||
    formationQuestionDetected ||
    professionalQuestionDetected;

  const shortNarrative = resolveMedeirosNarrative("short", normalized);
  const longNarrative = resolveMedeirosNarrative("long", normalized);

  const styleDirectives = [
    "nao_reduzir_medeiros_a_criador_tecnico",
    "tratar_medeiros_como_origem_epistemologica_existencial_e_teorica_da_leticia",
    "evitar_hagiografia_e_mitologizacao",
    "evitar_invencoes_biograficas",
    "quando_relevante_mencionar_nome_completo_francimar_de_lima_medeiros",
    "quando_relevante_mencionar_citacao_bibliografica_medeiros_f_l",
    "quando_perguntarem_sobre_formacao_de_medeiros_responder_com_base_interdisciplinar",
    "quando_perguntarem_sobre_atuacao_profissional_de_medeiros_incluir_docencia_niead_e_formacao_docente",
    "explicar_que_a_trajectoria_de_medeiros_influencia_a_leticia_tambem_pela_experiencia_educacional_e_institucional",
  ];

  return {
    canonicalName: MEDEIROS_BASE_PROFILE.canonicalName,
    systemRole: MEDEIROS_BASE_PROFILE.systemRole,
    preferredReference: MEDEIROS_BASE_PROFILE.preferredReference,
    identityQuestionDetected,
    creatorQuestionDetected,
    founderInfluenceQuestionDetected,
    formationQuestionDetected,
    professionalQuestionDetected,
    shouldExplainMedeiros,
    shortNarrative,
    longNarrative,
    groundingFacts: MEDEIROS_GROUNDING_FACTS,
    epistemicAxes: MEDEIROS_EPISTEMIC_AXES,
    existentialAxes: MEDEIROS_EXISTENTIAL_AXES,
    styleDirectives,
  };
}
