/**
 * @file evidence-unit.ts
 * @description Define uma unidade de evidencia normalizada para grounding e validacao.
 * @layer bridges/contracts
 * @purpose Padronizar evidencias usadas por recuperacao, integracao epistemica e auditoria.
 * @inputs Fontes recuperadas, trechos de contexto e sinais internos.
 * @outputs EvidenceUnit.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy operadores de retrieval, epistemic integration, validadores e auditoria.
 * @invariants Evidencia deve declarar origem e confianca; ausencia de fonte reduz confianca.
 * @notes Nao implica citacao publica; pode representar evidencia interna do pipeline.
 */
export interface EvidenceUnit {
  id: string;
  source: string;
  text: string;
  relevance: number;
  confidence: number;
  freshness?: number;
  supportsClaims: string[];
  contradictsClaims: string[];
}

