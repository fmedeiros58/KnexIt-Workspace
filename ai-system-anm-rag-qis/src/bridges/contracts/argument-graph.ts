/**
 * @file argument-graph.ts
 * @description Define uma representacao minima de argumentos, objecoes e suportes.
 * @layer bridges/contracts
 * @purpose Apoiar contraponto proporcional e restauracao de trilhas argumentativas.
 * @inputs Teses, evidencias, objecoes e operadores inferenciais.
 * @outputs ArgumentGraph, ArgumentNode e ArgumentEdge.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy camada inferencial, operadores de contexto, validacao e observabilidade.
 * @invariants A grafo argumentativo nao deve fabricar evidencias inexistentes.
 * @notes IDs sao strings para permitir integracao futura com memoria e fontes externas.
 */
export interface ArgumentNode {
  id: string;
  kind: "claim" | "premise" | "objection" | "counterexample" | "conclusion";
  text: string;
  confidence: number;
}

export interface ArgumentEdge {
  from: string;
  to: string;
  relation: "supports" | "attacks" | "qualifies" | "depends_on";
}

export interface ArgumentGraph {
  nodes: ArgumentNode[];
  edges: ArgumentEdge[];
  auditReasons: string[];
}

