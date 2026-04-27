/**
 * @file alternative-reading-builder.ts
 * @description Constroi leituras alternativas curtas do enunciado.
 * @layer 10-reflective-layer
 * @purpose Fornecer material para reflexao sem alongar a resposta final.
 * @inputs Texto do usuario.
 * @outputs Leituras alternativas candidatas.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy reflexao e auditoria.
 * @invariants Leituras alternativas devem ser marcadas como candidatas.
 * @notes Complementa alternative-interpretation-builder legado.
 */
export function buildAlternativeReadings(text: string): string[] {
  const readings: string[] = [];
  if (/\b(apenas|somente|restri[cç][aã]o)\b/i.test(text)) readings.push("leitura_com_restricao_forte");
  if (/\b(explique|ensine)\b/i.test(text)) readings.push("leitura_pedagogica");
  if (/\b(analise|debug|corrig)\b/i.test(text)) readings.push("leitura_tecnica");
  return readings.length ? readings : ["leitura_conversacional_padrao"];
}

