/**
 * @file layer-value-scorer.ts
 * @description Estima valor incremental e custo auditavel por camada.
 * @layer 19-observability-control-and-admin-layer
 * @purpose Apoiar revisao de custo-beneficio da descida adaptativa.
 * @inputs Nome da camada, modo resolvido e eventos de trace.
 * @outputs Valor adicionado e custo estimado.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy layer-audit-recorder.
 * @invariants O scorer nao altera estado e nao decide execucao de camadas.
 * @notes Heuristica leve para scorecard humano, nao medicao financeira.
 */
export function scoreLayerValue(layer: string, mode: string, traceActions: string[]): {
  valueAdded: string[];
  estimatedCost: "low" | "medium" | "high";
} {
  const valueAdded = traceActions.length > 0 ? traceActions.slice(-3) : [`mode:${mode}`];
  const estimatedCost =
    /heavy|epistemic-heavy|retrieval-heavy|dialogical-strong/.test(mode)
      ? "high"
      : /medium|required|structural-only/.test(mode)
        ? "medium"
        : "low";
  return {
    valueAdded: [`layer:${layer}`, ...valueAdded],
    estimatedCost,
  };
}

