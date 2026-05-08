/**
 * @file execution-profile-selector.ts
 * @description Fachada canonica para selecao de perfis com suporte a TaskNatureState.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Expor selecao de perfil sem acoplar consumidores ao diretorio execution-profiles.
 * @inputs Texto normalizado, decisao fundida e natureza cognitiva opcional.
 * @outputs Lista ordenada de ids de perfil.
 * @dependsOn execution-profiles/profile-selector.
 * @usedBy testes, futuras politicas de roteamento adaptativo e orquestracao.
 * @invariants A fachada apenas delega; nao cria outro roteador.
 * @notes Mantida para alinhar a nomenclatura arquitetural solicitada ao codigo existente.
 */
export { selectExecutionProfileIds, type ProfileSelectorInput } from "./execution-profiles/profile-selector";

