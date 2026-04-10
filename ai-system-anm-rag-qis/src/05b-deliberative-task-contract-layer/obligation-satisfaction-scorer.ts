/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: obligation-satisfaction-scorer.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Atribuir um score de satisfação para cada obrigação deliberativa isoladamente.
 * - Estimar se a resposta cobriu a obrigação com base em:
 *   - cobertura lexical;
 *   - cobertura dos critérios de satisfação;
 *   - sinal tipológico da obrigação;
 *   - orçamento mínimo de profundidade textual.
 *
 * Função no pipeline:
 * - Este arquivo NÃO decide o gate global da resposta.
 * - Este arquivo NÃO normaliza a resposta para entrega.
 * - Este arquivo NÃO repara conteúdo.
 * - Este arquivo produz apenas uma avaliação local por obrigação.
 *
 * Garantias esperadas:
 * - Produzir score comparável entre obrigações diferentes.
 * - Evitar aprovação fácil de respostas longas, porém irrelevantes.
 * - Tornar explícitas as fragilidades detectadas em cada obrigação.
 */

import type {
  DeliberativeObligation,
  ObligationSatisfactionScore,
} from "./deliberative-task-contract-types";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_/\\-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => `${item || ""}`.trim()).filter(Boolean)));
}

function splitTokens(text: string, minLength = 4): string[] {
  return normalize(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= minLength);
}

function hasCorruptedSurface(text: string): boolean {
  return /[�ÃÂ]|(?:\?\s*){2,}|(?:\s\?\s){1,}/.test(`${text || ""}`);
}

function tokensFromObligation(obligation: DeliberativeObligation): string[] {
  const labelTokens =
    `${obligation.label || ""}`.length > 180 || hasCorruptedSurface(obligation.label || "")
      ? []
      : splitTokens(obligation.label, 4).slice(0, 10);

  const criteriaTokens = obligation.satisfactionCriteria.flatMap((item) => splitTokens(item, 4));
  const hintTokens = (obligation.evidenceHints || []).flatMap((item) => splitTokens(item, 4));

  return uniqueStrings([...criteriaTokens, ...hintTokens, ...labelTokens]);
}

function criteriaPhrasesFromObligation(obligation: DeliberativeObligation): string[] {
  return uniqueStrings(
    obligation.satisfactionCriteria
      .map((item) => normalize(item))
      .filter((item) => item.length >= 8),
  );
}

function responseLexemes(text: string): string[] {
  return uniqueStrings(splitTokens(text, 3));
}

function responseSentenceCount(text: string): number {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function tokenMatchesLexemes(token: string, lexemes: string[]): boolean {
  if (!token) return false;

  const root = token.slice(0, Math.min(token.length, 6));

  return lexemes.some((lexeme) => {
    if (lexeme === token) return true;
    if (lexeme.includes(token) || token.includes(lexeme)) return true;

    if (
      root.length >= 4 &&
      (lexeme.startsWith(root) ||
        token.startsWith(lexeme.slice(0, Math.min(lexeme.length, 6))))
    ) {
      return true;
    }

    return false;
  });
}

function countTokenHits(tokens: string[], lexemes: string[]): number {
  let hits = 0;

  for (const token of tokens) {
    if (tokenMatchesLexemes(token, lexemes)) {
      hits += 1;
    }
  }

  return hits;
}

function countCriteriaPhraseHits(phrases: string[], normalizedResponse: string): number {
  let hits = 0;

  for (const phrase of phrases) {
    if (!phrase) continue;

    if (normalizedResponse.includes(phrase)) {
      hits += 1;
      continue;
    }

    const phraseTokens = phrase.split(" ").filter((token) => token.length >= 4);
    if (!phraseTokens.length) continue;

    const matchedTokens = phraseTokens.filter((token) => normalizedResponse.includes(token)).length;
    const ratio = matchedTokens / phraseTokens.length;

    if (ratio >= 0.6) {
      hits += 1;
    }
  }

  return hits;
}

function minCharBudgetByType(type: DeliberativeObligation["type"]): number {
  switch (type) {
    case "demonstration":
      return 360;
    case "distinction":
    case "evaluation":
    case "objection":
      return 240;
    case "proposal":
    case "comparison":
    case "decision":
      return 220;
    case "planning":
    case "diagnosis":
    case "synthesis":
      return 200;
    case "reformulation":
    case "assumption_audit":
      return 180;
    default:
      return 140;
  }
}

function minSentenceBudgetByType(type: DeliberativeObligation["type"]): number {
  switch (type) {
    case "demonstration":
      return 4;
    case "comparison":
    case "evaluation":
    case "objection":
    case "planning":
    case "diagnosis":
      return 3;
    default:
      return 2;
  }
}

function scoreTypeSignal(type: DeliberativeObligation["type"], normalizedResponse: string): number {
  const has = (pattern: RegExp) => pattern.test(normalizedResponse);

  switch (type) {
    case "demonstration":
      if (has(/\b(premissa|premissas|logo|portanto|implica|decorre|segue se|se .* entao|conclusao)\b/)) return 1;
      if (has(/\b(demonstr|prova|deriv|justific)\b/)) return 0.7;
      return 0;

    case "distinction":
      if (has(/\b(distin|diferenc|nao e o mesmo|por outro lado|ja|contradicao formal|insatisfazibilidade|inconsistencia de aplicacao)\b/)) return 1;
      if (has(/\b(contraste|separa|separacao)\b/)) return 0.7;
      return 0;

    case "proposal":
      if (has(/\b(modelo|alternativa|opcao|proposta|solucao|mecanismo operacional)\b/)) return 1;
      if (has(/\b(sugere|propoe|propor)\b/)) return 0.7;
      return 0;

    case "evaluation":
      if (has(/\b(custo|risco|tradeoff|impacto|vantagem|desvantagem)\b/)) return 1;
      if (has(/\b(avalia|avaliacao|avaliar)\b/)) return 0.7;
      return 0;

    case "explanation":
      if (has(/\b(porque|explica|explicacao|causa|mecanismo|relacao|articula|interage|estrutura|arquitetura)\b/)) return 1;
      if (has(/\b(ou seja|isto e)\b/)) return 0.7;
      return 0;

    case "comparison":
      if (has(/\b(compar|versus|mais .* que|menos .* que|melhor .* que|pior .* que)\b/)) return 1;
      if (has(/\b(diferenca|semelhanca)\b/)) return 0.7;
      return 0;

    case "planning":
      if (has(/\b(etapa|sequencia|passo|cronograma|plano)\b/)) return 1;
      if (has(/\b(primeiro|depois|em seguida)\b/)) return 0.7;
      return 0;

    case "diagnosis":
      if (has(/\b(causa|falha|sintoma|gargalo|origem do problema|diagnostico|variaveis centrais)\b/)) return 1;
      if (has(/\b(diagnost|diagnostico)\b/)) return 0.7;
      return 0;

    case "decision":
      if (has(/\b(recomend|escolh|prioriz|decisao)\b/)) return 1;
      if (has(/\b(indico|adoto|optaria)\b/)) return 0.7;
      return 0;

    case "synthesis":
      if (has(/\b(sintese|integracao|em conjunto|conclusao)\b/)) return 1;
      if (has(/\b(resumo|articulacao)\b/)) return 0.7;
      return 0;

    case "objection":
      if (has(/\b(objecao|objeccao|steelman|contra argumento|critica forte)\b/)) return 1;
      if (has(/\b(contraponto|fragilidade)\b/)) return 0.7;
      return 0;

    case "reformulation":
      if (has(/\b(reformul|incerteza|cenario|estimativa|sensibilidade|erro de medicao|faixas de estimativa|nao podem ser medidos com precisao|sob corte|com corte|orcamento reduzido|reducao orcamentaria|contingencia|novo cenario|mudanca de premissa|premissa alterada|dados incompletos|margem de erro)\b/)) return 1;
      if (has(/\b(revisao|ajuste)\b/)) return 0.7;
      return 0;

    case "assumption_audit":
      if (has(/\b(pressupost(?:o|os)?|premissa(?:s)?|sem provar|nao provad(?:o|os|a|as)?|limite(?:s)?|hipotese(?:s)? assumida(?:s)?)\b/)) return 1;
      if (has(/\b(condicao(?:oes)? assumida(?:s)?|restricao(?:oes)? assumida(?:s)?)\b/)) return 0.7;
      return 0;

    default:
      return 1;
  }
}

function computeThreshold(obligation: DeliberativeObligation): number {
  const base = clamp01(obligation.minimumExpectedDepth || 0.6);
  const softenedBase = 0.46 + (base * 0.34);

  switch (obligation.type) {
    case "demonstration":
      return Math.max(0.62, Math.min(0.76, softenedBase));
    case "objection":
    case "comparison":
    case "evaluation":
      return Math.max(0.58, Math.min(0.74, softenedBase));
    default:
      return Math.max(0.52, Math.min(0.72, softenedBase));
  }
}

function guardDepthBudget(params: {
  lexicalCoverage: number;
  criteriaCoverage: number;
  typeSignalScore: number;
  depthBudget: number;
}): number {
  const anchor = Math.max(
    params.lexicalCoverage,
    params.criteriaCoverage,
    params.typeSignalScore * 0.9,
  );

  if (anchor < 0.12) {
    return params.depthBudget * 0.2;
  }

  if (anchor < 0.2) {
    return params.depthBudget * 0.4;
  }

  if (anchor < 0.3) {
    return params.depthBudget * 0.7;
  }

  return params.depthBudget;
}

export function scoreObligationSatisfaction(
  obligation: DeliberativeObligation,
  responseText: string,
): ObligationSatisfactionScore {
  const rawResponse = `${responseText || ""}`.trim();

  if (!rawResponse) {
    return {
      obligationId: obligation.obligationId,
      label: obligation.label,
      type: obligation.type,
      score: 0,
      passed: false,
      issues: [
        "empty_response_for_obligation",
        "low_obligation_lexical_coverage",
        "low_satisfaction_criteria_coverage",
        "missing_type_specific_signal",
        "compressed_for_obligation_depth",
      ],
    };
  }

  const normalizedResponse = normalize(rawResponse);
  const tokens = tokensFromObligation(obligation);
  const phrases = criteriaPhrasesFromObligation(obligation);
  const lexemes = responseLexemes(rawResponse);

  const tokenHits = countTokenHits(tokens, lexemes);
  const lexicalCoverage = tokens.length > 0 ? tokenHits / tokens.length : 0;

  const phraseHits = countCriteriaPhraseHits(phrases, normalizedResponse);
  const criteriaCoverage = phrases.length > 0 ? phraseHits / phrases.length : lexicalCoverage;

  const typeSignalScore = scoreTypeSignal(obligation.type, normalizedResponse);

  const minCharBudget = minCharBudgetByType(obligation.type);
  const charBudgetScore = clamp01(rawResponse.length / Math.max(minCharBudget, 1));

  const minSentenceBudget = minSentenceBudgetByType(obligation.type);
  const sentenceBudgetScore = clamp01(
    responseSentenceCount(rawResponse) / Math.max(minSentenceBudget, 1),
  );

  const depthBudget = clamp01((charBudgetScore * 0.65) + (sentenceBudgetScore * 0.35));
  const guardedDepthBudget = guardDepthBudget({
    lexicalCoverage,
    criteriaCoverage,
    typeSignalScore,
    depthBudget,
  });

  let score = clamp01(
    (lexicalCoverage * 0.12) +
      (criteriaCoverage * 0.32) +
      (typeSignalScore * 0.34) +
      (guardedDepthBudget * 0.22),
  );

  const threshold = computeThreshold(obligation);

  const issues: string[] = [];
  if (lexicalCoverage < 0.28) issues.push("low_obligation_lexical_coverage");
  if (criteriaCoverage < 0.2) issues.push("low_satisfaction_criteria_coverage");
  if (typeSignalScore < 0.45) issues.push("missing_type_specific_signal");
  if (depthBudget < 0.55) issues.push("compressed_for_obligation_depth");
  if (guardedDepthBudget < depthBudget * 0.75) issues.push("depth_without_relevance_anchor");

  const strongSpecializedSignal =
    typeSignalScore >= 0.9 &&
    guardedDepthBudget >= 0.6 &&
    (obligation.type === "demonstration" ||
      obligation.type === "distinction" ||
      obligation.type === "proposal" ||
      obligation.type === "evaluation" ||
      obligation.type === "explanation" ||
      obligation.type === "diagnosis" ||
      obligation.type === "objection" ||
      obligation.type === "reformulation" ||
      obligation.type === "assumption_audit");

  if (strongSpecializedSignal) {
    score = Math.max(score, 0.78);
  }

  const passed =
    score >= threshold &&
    typeSignalScore >= 0.45 &&
    (
      criteriaCoverage >= 0.18 ||
      lexicalCoverage >= 0.34 ||
      strongSpecializedSignal ||
      ((obligation.type === "explanation" || obligation.type === "evaluation") &&
        typeSignalScore >= 0.9 &&
        guardedDepthBudget >= 0.72 &&
        rawResponse.length >= Math.max(220, minCharBudgetByType(obligation.type) * 0.9))
    );

  return {
    obligationId: obligation.obligationId,
    label: obligation.label,
    type: obligation.type,
    score: Number(score.toFixed(4)),
    passed,
    issues: uniqueStrings(issues),
  };
}
