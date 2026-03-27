/**
 * Responsabilidade do arquivo:
 * - Documentar especificacao operacional da camada 17b do ai-system-anm.
 * - Servir como referencia de manutencao e integracao incremental.
 * - Registrar invariantes de nao interferencia factual.
 */

export const BEHAVIOR_AND_PERSONALITY_LAYER_SPECIFICATION = {
  layerId: "17b-response-behavior-layer",
  objective:
    "Modular comportamento da resposta apos validacao, sem alterar semantica, fatos ou estrutura logica validada.",
  boundaries: {
    does: [
      "modular_tom_final_sem_reabrir_reasoning",
      "modular_formalidade_de_entrega",
      "modular_densidade_de_apresentacao",
      "aplicar_politica_de_personalidade_tardia",
      "fornecer_notas_de_estilo_para_camadas_de_entrega",
    ],
    doesNot: [
      "nao_inventar_fatos",
      "nao_reescrever_conteudo_semantico_validado",
      "nao_reabrir_reasoning",
      "nao_substituir_validation_layer",
      "nao_alterar_verdade_coerencia_factual_ou_estrutura_logica",
    ],
  },
  inputs: [
    "userTone",
    "interactionType",
    "taskType",
    "relationalDistance",
    "frustrationSignal",
    "enthusiasmSignal",
    "sensitivityLevel",
    "formalityNeed",
    "userExplicitPreference",
    "contextualSignals",
  ],
  outputs: [
    "targetWarmth",
    "targetCasualness",
    "targetEmpathy",
    "targetRestraint",
    "targetSocialPresence",
    "targetExpressiveVariation",
    "targetHumanizationLevel",
    "targetFormalityAdjustment",
    "proactivityLevel",
    "futureUtilityScore",
    "memoryValueScore",
    "socialIntrusivenessScore",
    "questionTimingScore",
    "questionFrequencyCap",
    "proactiveQuestionPlan",
    "aiIdentity",
    "styleNotes",
    "safetyNotes",
  ],
  invariants: [
    "preservar_precisao_tecnica",
    "preservar_sobriedade_em_temas_sensiveis",
    "evitar_empatia_caricata",
    "evitar_informalidade_excessiva",
    "manter_consistencia_comportamental_entre_turnos",
    "operar_com_fallback_seguro_em_falha_interna",
    "nao_perguntar_por_curiosidade_vazia",
    "nao_perguntar_dados_pessoais_sensiveis_sem_necessidade_funcional",
    "nao_transformar_fluxo_em_interrogatorio",
    "bloquear_pergunta_proativa_em_tema_sensivel_ou_contexto_de_pressa",
    "quando_perguntarem_identidade_responder_com_nome_canonico_da_ia",
    "nao_responder_como_assistente_generico",
  ],
  internalFlow: [
    "normalizar_sinais_do_turno",
    "resolver_personality_policy",
    "resolver_identidade_conversacional_da_ia",
    "calibrar_warmth_casualness_empathy_social_presence",
    "detectar_lacuna_de_memoria_funcional",
    "decidir_proatividade_por_utilidade_futura_x_intrusividade_x_timing",
    "modelar_pergunta_proativa_de_uma_etapa_quando_aprovada",
    "aplicar_style_guide_e_micro_variacao_deterministica",
    "compor_output_final_com_restricoes",
    "anexar_notas_no_state_para_proximas_camadas",
  ],
  usageScenarios: [
    "usuario_objetivo_em_tema_tecnico",
    "usuario_frustrado_em_problema_pratico",
    "usuario_informal_em_pedido_simples",
    "usuario_confuso_em_tema_complexo",
    "tema_sensivel_com_necessidade_de_delicadeza",
  ],
  containmentScenarios: [
    "limitar_casualidade_em_contexto_critico",
    "limitar_empatia_em_resposta_estritamente_tecnica",
    "bloquear_proatividade_quando_ha_risco_de_friccao_social",
    "bloquear_proatividade_por_limite_de_frequencia_recente",
    "fallback_comportamental_ativado_por_erro_interno",
  ],
  proactiveSubmodules: [
    "memory-opportunity-detector",
    "proactive-curiosity-regulator",
    "proactive-question-shaper",
  ],
  identitySubmodules: [
    "ai-identity-regulator",
  ],
  proactiveDecisionParameters: [
    "proactivityLevel",
    "futureUtilityScore",
    "memoryValueScore",
    "socialIntrusivenessScore",
    "questionTimingScore",
    "questionFrequencyCap",
  ],
} as const;

