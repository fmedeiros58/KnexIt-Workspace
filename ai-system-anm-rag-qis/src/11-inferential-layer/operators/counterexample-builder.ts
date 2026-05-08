/**
 * @file counterexample-builder.ts
 * @description Constroi contraexemplo textual simples para testar uma tese.
 * @layer 11-inferential-layer
 * @purpose Apoiar verificacao de implicacoes e contraponto.
 * @inputs Tese e caso candidato.
 * @outputs Contraexemplo compacto.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy camada inferencial e validacao dialogica.
 * @invariants Contraexemplo deve ser marcado como candidato se nao houver evidencia.
 * @notes Evita apresentar possibilidade como refutacao conclusiva.
 */
export function buildCounterexample(thesis: string, candidateCase: string): string {
  return `Contraexemplo candidato para "${thesis}": ${candidateCase}`;
}

