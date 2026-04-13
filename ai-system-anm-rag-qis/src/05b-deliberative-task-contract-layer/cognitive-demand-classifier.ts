import type { CognitiveDemand, CognitiveDemandProfile, TaskArchetype } from "./deliberative-task-contract-types";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(source: string, patterns: RegExp[]): number {
  return patterns.reduce((acc, pattern) => (pattern.test(source) ? acc + 1 : acc), 0);
}

function hasEnumeratedStructure(source: string): boolean {
  const enumeratedHits = (source.match(/\(\s*[a-z0-9]+\s*\)/g) || []).length;
  const numericHits = (source.match(/\b(?:\d+[\.\)]\s+)[^.;\n]+/g) || []).length;
  return enumeratedHits >= 2 || numericHits >= 2;
}

function countEnumeratedItems(source: string): number {
  const alpha = (source.match(/\(\s*[a-z0-9]+\s*\)/g) || []).length;
  const numeric = (source.match(/\b(?:\d+[\.\)]\s+)[^.;\n]+/g) || []).length;
  return Math.max(alpha, numeric);
}

function inferTaskArchetypes(normalized: string): TaskArchetype[] {
  const archetypes = new Set<TaskArchetype>();

  if (/\b(defina|definir|conceitue|o que e|define|definition|what is|conceptualize)\b/.test(normalized)) {
    archetypes.add("define");
  }
  if (/\b(explique|explicar|por que|como funciona|qual o significado|explain|why|how it works|meaning)\b/.test(normalized)) {
    archetypes.add("explain");
  }
  if (/\b(compare|comparar|diferenca|difference|versus|vs\.?|melhor que|better than|pior que|worse than|qual abordagem|which approach|vale mais a pena)\b/.test(normalized)) {
    archetypes.add("compare");
  }
  if (/\b(demonstre|demonstrar|demonstrate|prove|provar|formalmente|formally|mostre por que|show why)\b/.test(normalized)) {
    archetypes.add("demonstrate");
  }
  if (/\b(avali[eiar]|julgue|analise|analisar|evaluate|assess|critique|criticar|quao bom|quao ruim|defenda|defend)\b/.test(normalized)) {
    archetypes.add("evaluate");
  }
  if (/\b(obje\b|objec(?:ao|oes|a|o)?\b|objections?\b|contra argumento|counter argument|counterargument|steelman|ataque a propria|critica mais forte|strongest objection)\b/.test(normalized)) {
    archetypes.add("criticize");
  }
  if (/\b(plano|planeje|planejar|plan|roadmap|passo a passo|step by step|roteiro|sequencia|sequence|organizar|organize|how to organize|como organizar)\b/.test(normalized)) {
    archetypes.add("plan");
  }
  if (/\b(diagnostique|diagnosticar|diagnose|falha|failure|problema|problem|causa raiz|root cause|bottleneck)\b/.test(normalized)) {
    archetypes.add("diagnose");
  }
  if (/\b(decida|decidir|decide|escolher|choose|priorizar|prioritize|trade-?off|compensacao|qual solucao|which solution|qual abordagem e melhor|best approach)\b/.test(normalized)) {
    archetypes.add("decide");
  }
  if (/\b(sintetize|sintese|resuma|synthesize|summary|integrar|integrate|compatibilizar|reconcile)\b/.test(normalized)) {
    archetypes.add("synthesize");
  }
  if (/\b(formaliz|formalize|axioma|axiom|predicado|predicate|proposicao|proposition)\b/.test(normalized)) {
    archetypes.add("formalize");
  }
  if (/\b(decomponha|decompor|decompose|quebre em partes|break down|subproblemas|subproblems)\b/.test(normalized)) {
    archetypes.add("decompose");
  }
  if (/\b(alternativas|alternatives|modelos?|models?|opcoes|options)\b/.test(normalized)) {
    archetypes.add("propose_alternatives");
  }
  if (/\b(estim\w*|estimate\w*|probabilidade\w*|probability|incerteza|uncertainty|faixa|interval|margin of error|precisao|medidos com precisao)\b/.test(normalized)) {
    archetypes.add("estimate");
  }
  if (/\b(pressupost\w*|assumptions?\b|premiss\w*|premises?\b|sem provar|without proving|unproven)\b/.test(normalized)) {
    archetypes.add("review_assumptions");
  }
  if (/\b(autocritica|self critique|counter your own|contra sua propria|objec(?:ao|oes|a|o)?\s+a\s+propria|obje\s+a\s+propria|ataque a propria|critica mais forte|strongest objection)\b/.test(normalized)) {
    archetypes.add("construct_objection");
  }
  if (/\b(restricoes concorrentes|criterios concorrentes|competing criteria|balance|equilibrar)\b/.test(normalized)) {
    archetypes.add("reconcile_competing_criteria");
  }

  if (/\b(melhor|best)\b/.test(normalized) && /\b(sem|mas|equilibrar|manter|without|while|balance)\b/.test(normalized)) {
    archetypes.add("decide");
    archetypes.add("compare");
  }
  if (hasEnumeratedStructure(normalized)) {
    archetypes.add("decompose");
  }
  if (!archetypes.size && normalized.includes("?")) archetypes.add("explain");
  return Array.from(archetypes);
}

function inferCognitiveDemands(normalized: string, archetypes: TaskArchetype[]): CognitiveDemand[] {
  const demands = new Set<CognitiveDemand>();
  const has = (item: TaskArchetype) => archetypes.includes(item);

  if (/\b(porque|because|causa|cause|consequencia|consequence|implica|implies)\b/.test(normalized)) {
    demands.add("causal_reasoning");
  }
  if (/\b(trade-?off|equilibr|balance|compensacao|custo marginal|sem perder|without losing|ao mesmo tempo|at the same time|sem sacrificar|without sacrificing)\b/.test(normalized)) {
    demands.add("tradeoff_analysis");
  }
  if (/\b(restricao|constraint|limite|limit|orcamento|budget|tempo|time|maximo|minimum|minimo|feasibility|viabilidade)\b/.test(normalized)) {
    demands.add("constraint_satisfaction");
  }
  if (/\b(incerteza|uncertainty|estimad|estimate|probabilidade|probability|sensibilidade|sensitivity|cenario|scenario|margin of error)\b/.test(normalized)) {
    demands.add("uncertainty_handling");
  }
  if (/\b(passo|step|etapa|stage|sequencia|sequence|depois|antes|ao final|finally|first|second|third)\b/.test(normalized)) {
    demands.add("multi_step_execution");
  }
  if (has("demonstrate") || has("formalize")) demands.add("proof_or_justification");
  if (has("criticize") || has("construct_objection")) demands.add("counter_argumentation");
  if (has("compare") || has("propose_alternatives") || has("decide")) demands.add("model_comparison");
  if (has("synthesize")) demands.add("synthesis");

  if (has("diagnose")) {
    demands.add("causal_reasoning");
    demands.add("constraint_satisfaction");
  }

  if (!demands.size) {
    if (has("explain")) demands.add("causal_reasoning");
    if (has("evaluate")) demands.add("tradeoff_analysis");
  }
  return Array.from(demands);
}

export function classifyCognitiveDemand(message: string): CognitiveDemandProfile {
  const normalized = normalize(message);
  if (!normalized) {
    return {
      taskArchetypes: [],
      cognitiveDemands: [],
      reasoningIntensity: 0,
      structuralComplexity: 0,
      answerFormatNeeds: [],
      requiresDeliberativeContract: false,
      requiresFormalization: false,
      requiresAlternatives: false,
      requiresSelfObjection: false,
      requiresAssumptionAudit: false,
      requiresStructuredCoverage: false,
    };
  }

  const archetypes = inferTaskArchetypes(normalized);
  const demands = inferCognitiveDemands(normalized, archetypes);
  const enumeratedItems = countEnumeratedItems(message);

  const decompositionHits = countMatches(normalized, [
    /\b(e depois|alem disso|por fim|ao final|em seguida|then|after that|finally)\b/,
    /\b(primeiro|segundo|terceiro|first|second|third)\b/,
    /\b(duas alternativas|dois modelos|mais de uma opcao|at least two models|more than one option)\b/,
  ]);
  const constraintHits = countMatches(normalized, [
    /\b(orcamento|budget|tempo|time|limite|limit|restricao|constraint|recurso|resource|feasibility|viabilidade)\b/,
    /\b(maximizar|maximize|minimizar|minimize|otimizar|optimize|priorizar|prioritize)\b/,
  ]);
  const complexityHints = countMatches(normalized, [
    /\b(analise|analyze|avaliar|evaluate|diagnosticar|diagnose|planejar|plan|trade-?off)\b/,
    /\b(conflito|conflict|tensao|tension|criterios concorrentes|competing criteria)\b/,
    /\b(incerteza|uncertainty|estimad|estimate|probabilidade|probability|margin of error)\b/,
  ]);
  const listStructure = hasEnumeratedStructure(message) ? 0.18 : 0;

  const operationBreadth = clamp01(archetypes.length / 6);
  const demandBreadth = clamp01(demands.length / 5);
  const reasoningIntensity = clamp01(
    (operationBreadth * 0.34) +
      (demandBreadth * 0.26) +
      (Math.min(1, complexityHints * 0.22)) +
      (Math.min(1, decompositionHits * 0.11)) +
      (Math.min(1, enumeratedItems * 0.04) * 0.11) +
      listStructure,
  );
  const structuralComplexity = clamp01(
    (Math.min(1, decompositionHits * 0.3)) +
      (Math.min(1, constraintHits * 0.24)) +
      (operationBreadth * 0.26) +
      (Math.min(1, enumeratedItems * 0.05) * 0.2) +
      (listStructure * 0.75),
  );

  const requiresFormalization = archetypes.includes("demonstrate") || archetypes.includes("formalize");
  const requiresAlternatives =
    archetypes.includes("propose_alternatives") || archetypes.includes("compare") || archetypes.includes("decide");
  const requiresSelfObjection =
    archetypes.includes("construct_objection") || archetypes.includes("criticize");
  const requiresAssumptionAudit = archetypes.includes("review_assumptions");
  const requiresStructuredCoverage =
    structuralComplexity >= 0.46 || hasEnumeratedStructure(message) || enumeratedItems >= 3;

  const answerFormatNeeds = Array.from(
    new Set([
      ...(requiresStructuredCoverage ? ["sectioned_answer"] : []),
      ...(requiresAlternatives ? ["alternatives"] : []),
      ...(requiresFormalization ? ["proof_chain"] : []),
      ...(requiresSelfObjection ? ["steelman_objection"] : []),
      ...(requiresAssumptionAudit ? ["assumption_ledger"] : []),
      ...(demands.includes("uncertainty_handling") ? ["uncertainty_reformulation"] : []),
    ]),
  );

  const requiresDeliberativeContract =
    reasoningIntensity >= 0.44 ||
    enumeratedItems >= 3 ||
    (requiresStructuredCoverage && archetypes.length >= 2) ||
    (requiresAlternatives && demands.includes("tradeoff_analysis")) ||
    (requiresFormalization && demands.length >= 1) ||
    (archetypes.includes("decide") && (archetypes.includes("compare") || demands.includes("constraint_satisfaction"))) ||
    (archetypes.includes("decide") && archetypes.includes("reconcile_competing_criteria")) ||
    (archetypes.includes("plan") && (demands.includes("tradeoff_analysis") || demands.includes("constraint_satisfaction"))) ||
    (archetypes.includes("diagnose") && /\b(corrigir|correcao|fix|repair|causa raiz|root cause|onde esta a falha|where is the failure)\b/.test(normalized));

  return {
    taskArchetypes: archetypes,
    cognitiveDemands: demands,
    reasoningIntensity: Number(reasoningIntensity.toFixed(4)),
    structuralComplexity: Number(structuralComplexity.toFixed(4)),
    answerFormatNeeds,
    requiresDeliberativeContract,
    requiresFormalization,
    requiresAlternatives,
    requiresSelfObjection,
    requiresAssumptionAudit,
    requiresStructuredCoverage,
  };
}
