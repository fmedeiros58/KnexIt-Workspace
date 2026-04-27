/**
 * @file profile-composition-rules.ts
 * @description Reexporta regras de composicao de perfil para o namespace da camada 05.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Evitar duplicacao e manter um ponto canonico de importacao para consumidores novos.
 * @inputs Perfis de execucao selecionados.
 * @outputs Politicas compostas de memoria, retrieval, reflexao e validacao.
 * @dependsOn activation-policy/profile-composition-rules.
 * @usedBy testes e modulos de auditoria.
 * @invariants Deve preservar a implementacao existente na subcamada activation-policy.
 * @notes Este arquivo e uma fachada; a logica permanece consolidada no modulo existente.
 */
export { composeProfilePolicies } from "./activation-policy/profile-composition-rules";

