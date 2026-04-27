/**
 * @file layer-mode-resolver.ts
 * @description Reexporta o resolvedor de modo por camada no namespace principal da camada 05.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Facilitar revisao e uso sem duplicar a politica ja existente.
 * @inputs ProcessingState e id de camada.
 * @outputs LayerMode resolvido.
 * @dependsOn activation-policy/layer-mode-resolver.
 * @usedBy operadores intracamada e testes.
 * @invariants A resolucao continua lendo o AdaptivePipelineContract, nao um roteador paralelo.
 * @notes Fachada de compatibilidade arquitetural.
 */
export { resolveLayerModeFromState } from "./activation-policy/layer-mode-resolver";

