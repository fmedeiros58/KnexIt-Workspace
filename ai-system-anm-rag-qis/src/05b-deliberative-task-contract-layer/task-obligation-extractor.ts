import type { DeliberativeObligation, DeliberativeObligationType } from "./deliberative-task-contract-types";
import { classifyCognitiveDemand } from "./cognitive-demand-classifier";

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function obligationTypeFromLabel(label: string): DeliberativeObligationType {
  const normalized = normalize(label);
  if (/\b(demonstre|demonstrate|formal|prova|proof|derive|derivation|justifique formalmente|show why)\b/.test(normalized)) {
    return "demonstration";
  }
  if (/\b(obje\b|objec(?:ao|oes|a|o)?\b|objection\b|steelman\b|contra argumento|counter argument|counterargument|autocritica|self critique)\b/.test(normalized)) {
    return "objection";
  }
  if (/\b(reformul\w*|reformulate\w*|revisite\w*|revisit\w*|sob incerteza|under uncertainty|cenario alternativo|error margin|margin of error|estimad\w*)\b/.test(normalized)) {
    return "reformulation";
  }
  if (/\b(pressupost\w*|assumptions?\b|premiss\w*|premises?\b|sem provar|without proving|unproven)\b/.test(normalized)) {
    return "assumption_audit";
  }
  if (/\b(distingu\w*|diferenc\w*|difference\w*|contradic\w*|contradiction\w*|inconsist\w*|inconsistency\w*|limite conceitual)\b/.test(normalized)) {
    return "distinction";
  }
  if (/\b(avali|evaluate|assess|crit|custo|cost|risco|risk|trade ?off|tradeoff|impacto|impact|preco)\b/.test(normalized)) {
    return "evaluation";
  }
  if (/\b(proponha|propose|modelo|model|alternativa|alternative|opcoes|options)\b/.test(normalized)) {
    return "proposal";
  }
  if (/\b(explique|explain|explicacao|because|porque|como funciona|how)\b/.test(normalized)) {
    return "explanation";
  }
  if (/\b(compare|comparacao|comparison|versus|better|worse|melhor que|pior que)\b/.test(normalized)) {
    return "comparison";
  }
  if (/\b(plano|plan|planeje|roadmap|roteiro|etapas?|steps|sequencia|sequence)\b/.test(normalized)) {
    return "planning";
  }
  if (/\b(diagnostique|diagnose|causa raiz|root cause|falha|failure|gargalo|bottleneck)\b/.test(normalized)) {
    return "diagnosis";
  }
  if (/\b(decida|decide|escolha|choose|priorize|prioritize|priorizacao|selection)\b/.test(normalized)) {
    return "decision";
  }
  if (/\b(sintetize|synthesize|integrar|integrate|consolidar|consolidate|resuma|summary)\b/.test(normalized)) {
    return "synthesis";
  }
  return "evaluation";
}

const CANONICAL_LABEL_BY_TYPE: Record<DeliberativeObligationType, string> = {
  demonstration: "Executar demonstracao com encadeamento inferencial explicito.",
  distinction: "Distinguir conceitos e fronteiras de aplicacao sem ambiguidades.",
  proposal: "Propor alternativas factiveis com mecanismo operacional.",
  evaluation: "Avaliar trade-offs e impactos relevantes de forma justificada.",
  explanation: "Explicar o mecanismo central com clareza semantica.",
  comparison: "Comparar opcoes com criterios consistentes.",
  planning: "Apresentar plano por etapas com dependencias claras.",
  diagnosis: "Diagnosticar causas provaveis com sinais e evidencias.",
  decision: "Justificar a recomendacao com criterio de escolha explicito.",
  synthesis: "Sintetizar os achados em conclusao integrada.",
  objection: "Construir objecao steelman contra a solucao preferida.",
  reformulation: "Reformular a conclusao sob incerteza e margem de erro.",
  assumption_audit: "Explicitar pressupostos e limites nao provados.",
};

function compactLabel(label: string): string {
  return `${label || ""}`
    .replace(/\r\n?/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\(?\s*[a-z0-9]+\s*\)?\s*[:\-]\s*/i, "")
    .trim();
}

function shouldUseCanonicalLabel(compactedLabel: string): boolean {
  if (!compactedLabel) return true;
  if (compactedLabel.length > 180) return true;
  if (
    /\b(considere(?:mos)?|consider a hypothetical social system|without initially referring|sem recorrer inicialmente|follow these steps|faca o seguinte)\b/i.test(
      compactedLabel,
    )
  ) {
    return true;
  }
  return false;
}

function sanitizeObligationLabel(rawLabel: string, type: DeliberativeObligationType): string {
  const compacted = compactLabel(rawLabel);
  if (shouldUseCanonicalLabel(compacted)) {
    return CANONICAL_LABEL_BY_TYPE[type];
  }
  return compacted;
}

function buildEvidenceHints(label: string, type: DeliberativeObligationType): string[] {
  const normalized = normalize(label);
  const hints = new Set<string>([
    `type:${type}`,
  ]);

  if (/\bformal|prova|deriv|demonstr/.test(normalized)) hints.add("requires_formal_chain");
  if (/\bmodelo|alternativa|opcao/.test(normalized)) hints.add("requires_alternative_models");
  if (/\bcusto|risco|tradeoff|impacto/.test(normalized)) hints.add("requires_tradeoff_analysis");
  if (/\bobjecao|contra argumento|steelman/.test(normalized)) hints.add("requires_self_objection");
  if (/\bincerteza|estimad|faixa|margem/.test(normalized)) hints.add("requires_uncertainty_reformulation");
  if (/\bpressupost|premissa|limite/.test(normalized)) hints.add("requires_assumption_ledger");

  return Array.from(hints);
}

function criteriaByType(type: DeliberativeObligationType): string[] {
  switch (type) {
    case "demonstration":
      return ["encadeamento_logico_explicito", "nao_apenas_afirmacao"];
    case "distinction":
      return ["fronteiras_conceituais_explicitas", "condicoes_de_aplicacao"];
    case "proposal":
      return ["alternativas_viaveis", "mecanismo_operacional"];
    case "evaluation":
      return ["tradeoffs_explicitos", "criterios_justificados"];
    case "explanation":
      return ["relacao_causal_ou_funcional", "clareza_semantica"];
    case "comparison":
      return ["criterio_comparativo", "diferencas_relevantes"];
    case "planning":
      return ["sequenciamento_pratico", "dependencias_explicitadas"];
    case "diagnosis":
      return ["causas_provaveis", "sinais_evidenciais"];
    case "decision":
      return ["criterio_de_escolha", "justificativa_da_priorizacao"];
    case "synthesis":
      return ["integracao_das_partes", "conclusao_unificadora"];
    case "objection":
      return ["steelman_real", "ataque_a_ponto_critico"];
    case "reformulation":
      return ["conclusao_revisada", "ajuste_sob_incerteza"];
    case "assumption_audit":
      return ["premissas_nao_provadas_explicitadas"];
    default:
      return ["cobertura_explicita"];
  }
}

function minDepthByType(type: DeliberativeObligationType): number {
  switch (type) {
    case "demonstration":
    case "objection":
      return 0.82;
    case "distinction":
    case "evaluation":
    case "decision":
      return 0.74;
    case "proposal":
    case "planning":
    case "diagnosis":
      return 0.72;
    case "comparison":
    case "synthesis":
      return 0.7;
    case "explanation":
    case "reformulation":
      return 0.66;
    case "assumption_audit":
      return 0.64;
    default:
      return 0.62;
  }
}

function buildObligation(label: string, index: number, dependencies: string[]): DeliberativeObligation {
  const type = obligationTypeFromLabel(label);
  const sanitizedLabel = sanitizeObligationLabel(label, type);
  return {
    obligationId: `obl_${index + 1}`,
    label: sanitizedLabel,
    type,
    priority: Math.max(1, 100 - index * 6),
    dependencies,
    satisfactionCriteria: criteriaByType(type),
    minimumExpectedDepth: minDepthByType(type),
    evidenceHints: buildEvidenceHints(label, type),
  };
}

function hasImperativeExecutionCue(text: string): boolean {
  return /\b(demonstre|demonstrate|explique|explain|compare|analise|analyze|avali|evaluate|proponha|propose|decida|decide|planeje|plan|diagnostique|diagnose|reformule|reformulate|explicite|state explicitly|mostre|show|resuma|summarize|sintetize|synthesize|justify|justifique|construa|construct)\b/i.test(
    `${text || ""}`,
  );
}

function extractEnumeratedObligations(raw: string): string[] {
  const regex = /\(\s*([a-z0-9]+)\s*\)\s*([\s\S]*?)(?=(?:\(\s*[a-z0-9]+\s*\))|$)/gi;
  const alphaItems: string[] = [];
  const numericItems: string[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(raw)) !== null) {
    const marker = `${match[1] || ""}`.trim().toLowerCase();
    const content = `${match[2] || ""}`.replace(/\s+/g, " ").trim();
    if (!content) continue;

    if (/^[a-z]$/.test(marker)) {
      alphaItems.push(content);
      continue;
    }

    if (/^\d+$/.test(marker) && hasImperativeExecutionCue(content)) {
      numericItems.push(content);
    }
  }

  if (alphaItems.length > 0) {
    return alphaItems;
  }

  return numericItems;
}

function extractImperativeSegments(raw: string): string[] {
  const segments = `${raw || ""}`
    .split(/[\n;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return segments.filter((item) => hasImperativeExecutionCue(item));
}

function inferImplicitObligations(prompt: string): string[] {
  const profile = classifyCognitiveDemand(prompt);
  const labels: string[] = [];

  if (profile.taskArchetypes.includes("define")) labels.push("Definir os termos centrais e seu escopo operacional.");
  if (profile.taskArchetypes.includes("explain")) labels.push("Explicar o mecanismo causal ou funcional relevante.");
  if (profile.taskArchetypes.includes("demonstrate")) labels.push("Demonstrar o ponto central com encadeamento logico.");
  if (profile.taskArchetypes.includes("compare")) labels.push("Comparar opcoes usando criterios consistentes.");
  if (profile.taskArchetypes.includes("propose_alternatives")) labels.push("Propor mais de uma alternativa factivel.");
  if (profile.taskArchetypes.includes("evaluate")) labels.push("Avaliar custos, riscos e consequencias relevantes.");
  if (profile.taskArchetypes.includes("decide")) labels.push("Justificar a escolha recomendada e seus trade-offs.");
  if (profile.taskArchetypes.includes("construct_objection")) labels.push("Construir uma objecao forte contra a solucao preferida.");
  if (profile.taskArchetypes.includes("estimate")) labels.push("Reformular a conclusao sob incerteza de estimacao.");
  if (profile.taskArchetypes.includes("review_assumptions")) labels.push("Explicitar pressupostos e limites nao demonstrados.");
  if (profile.taskArchetypes.includes("plan")) labels.push("Organizar plano de execucao por etapas e dependencias.");
  if (profile.taskArchetypes.includes("diagnose")) labels.push("Diagnosticar causas provaveis e sinais de falha.");
  if (profile.taskArchetypes.includes("synthesize")) labels.push("Sintetizar os achados em conclusao unificada.");

  return Array.from(new Set(labels));
}

export function taskObligationExtractor(prompt: string): DeliberativeObligation[] {
  const raw = `${prompt || ""}`;
  const normalized = normalize(raw);
  if (!normalized) return [];

  const explicit = extractEnumeratedObligations(raw);
  const imperative = extractImperativeSegments(raw);
  const implicit = inferImplicitObligations(raw);
  const labels = explicit.length > 0 ? explicit : [...imperative, ...implicit];

  const uniqueLabels = Array.from(new Set(labels.map((item) => compactLabel(item)).filter(Boolean)));
  const obligations = uniqueLabels.map((label, index) =>
    buildObligation(label, index, index === 0 ? [] : [`obl_${index}`]),
  );

  const dedupedByLabel = new Map<string, DeliberativeObligation>();
  for (const obligation of obligations) {
    const key = normalize(obligation.label);
    if (!key) continue;
    if (!dedupedByLabel.has(key)) {
      dedupedByLabel.set(key, obligation);
    }
  }

  return Array.from(dedupedByLabel.values()).map((item, index) => ({
    ...item,
    obligationId: `obl_${index + 1}`,
    dependencies: index === 0 ? [] : [`obl_${index}`],
  }));
}

