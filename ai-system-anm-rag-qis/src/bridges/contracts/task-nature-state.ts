/**
 * @file task-nature-state.ts
 * @description Representa a classificacao auditavel da natureza cognitiva da tarefa.
 * @layer bridges/contracts
 * @purpose Guardar hipoteses, scores e sinais sem misturar isso com intent conversacional.
 * @inputs Texto normalizado, sinais de conversa, heuristicas locais e leitura de sessao.
 * @outputs TaskNatureState e TaskNatureHypothesis.
 * @dependsOn cognitive-task-type.
 * @usedBy orquestracao, task-contract-builder, seletores de perfil, validacao e auditoria.
 * @invariants selectedTaskType deve sempre existir e vir do catalogo canonico.
 * @notes confidence mede adequacao relativa das hipoteses, nao verdade semantica absoluta.
 */
import type { CognitiveTaskType } from "./cognitive-task-type";

export interface TaskNatureHypothesis {
  taskType: CognitiveTaskType;
  score: number;
  matchedSignals: string[];
  rationale: string;
}

export interface TaskNatureState {
  version: string;
  selectedTaskType: CognitiveTaskType;
  confidence: number;
  hypotheses: TaskNatureHypothesis[];
  conversationalIntents: string[];
  sessionSignals: string[];
  requiresRetrieval: boolean;
  requiresCounterposition: boolean;
  requiresStrongValidation: boolean;
  requiresConstraintTracking: boolean;
  expectedResponseShape: string[];
  auditTrail: string[];
}

