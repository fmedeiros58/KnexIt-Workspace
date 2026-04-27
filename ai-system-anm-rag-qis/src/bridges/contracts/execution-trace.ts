/**
 * @file execution-trace.ts
 * @description Define um rastro de execucao arquitetural de alto nivel.
 * @layer bridges/contracts
 * @purpose Registrar decisoes por etapa sem expor logs internos volumosos.
 * @inputs Eventos de camada, contratos, validadores e politicas adaptativas.
 * @outputs ExecutionTrace e ExecutionTraceStep.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy observabilidade, feedback e revisao humana.
 * @invariants O trace deve ser serializavel e nao conter dados sensiveis desnecessarios.
 * @notes Complementa ProcessingTraceEvent com campos orientados a auditoria cognitiva.
 */
export interface ExecutionTraceStep {
  layer: string;
  action: string;
  mode: string;
  valueAdded: string[];
  estimatedCost: "low" | "medium" | "high";
  risks: string[];
}

export interface ExecutionTrace {
  steps: ExecutionTraceStep[];
  coherenceScore: number;
  auditReasons: string[];
}

