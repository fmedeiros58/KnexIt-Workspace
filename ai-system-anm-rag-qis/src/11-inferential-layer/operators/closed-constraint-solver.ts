/**
 * @file closed-constraint-solver.ts
 * @description Resolve padroes pequenos de deducao fechada por atribuicao finita, sem hardcode de entidades especificas.
 * @layer 11-inferential-layer
 * @purpose Fornecer uma conclusao estrutural para problemas com etiquetas erradas, dominio finito e uma unica observacao permitida.
 * @inputs Enunciado da tarefa, rotulos opcionais e sinais de restricao explicita.
 * @outputs Resultado de solver com acao recomendada, passos condicionais e confianca.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy inferential-layer-bridge e validadores de deducao fechada.
 * @invariants O solver so atua quando reconhece dominio finito e restricoes suficientes; caso contrario retorna recognized=false.
 * @notes A regra e generica para rotulo misto errado; nomes como frutas, cores ou objetos sao tratados como labels, nao como casos hardcoded.
 */
import { decodeLikelyMojibake } from "../../shared/text-processing/mojibake-core";

export interface ClosedConstraintSolverInput {
  prompt: string;
  labels?: string[];
}

export interface ClosedConstraintSolverResult {
  recognized: boolean;
  pattern: "all-labels-wrong-single-mixed-observation" | "unsupported";
  confidence: number;
  action: string | null;
  conclusions: string[];
  steps: string[];
  extractedLabels: string[];
  issues: string[];
}

function normalizeLineEndings(value: string): string {
  return `${value || ""}`.replace(/\r\n?/g, "\n");
}

function repairRecognitionEncoding(value: string): string {
  return decodeLikelyMojibake(`${value || ""}`)
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã©/g, "é")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ãç/g, "ç")
    .replace(/Ã§/g, "ç")
    .replace(/usu[\uFFFD?]+rio/gi, "usuario")
    .replace(/let[\uFFFD?]+cia/gi, "Leticia");
}

function normalizeForCompare(value: string): string {
  return repairRecognitionEncoding(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\uFFFD?]+/g, "")
    .replace(/[^\p{L}\p{N}\s+&/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLabel(value: string): string {
  return repairRecognitionEncoding(value)
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/g, "")
    .replace(/[.;,]+$/g, "")
    .trim();
}

function isLikelyLabel(value: string): boolean {
  const label = cleanLabel(value);
  if (!label || label.length > 48) {
    return false;
  }

  const normalized = normalizeForCompare(label);
  if (!normalized) {
    return false;
  }

  if (/[:]/.test(label)) {
    return false;
  }

  if (/\b(pergunta|como|descobrir|voce|voces|sabe|sabemos|pode|tirar|apenas|unica|caixa|caixas|etiqueta|etiquetas|errada|erradas|conteudo)\b/.test(normalized)) {
    return false;
  }

  return normalized.split(/\s+/g).length <= 5;
}

function extractLabelsFromPrompt(prompt: string): string[] {
  const lines = normalizeLineEndings(prompt)
    .split("\n")
    .map(cleanLabel)
    .filter(isLikelyLabel);

  const seen = new Set<string>();
  const labels: string[] = [];

  for (const line of lines) {
    const key = normalizeForCompare(line);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    labels.push(line);
  }

  return labels.slice(0, 6);
}

function hasAllLabelsWrongSignal(prompt: string): boolean {
  const normalized = normalizeForCompare(prompt);
  return (
    /\btod[ao]s?\s+(?:as\s+)?etiquetas?\b/.test(normalized) &&
    /\berrad[ao]s?\b/.test(normalized)
  ) ||
    /\btod[ao]s?\s+(?:as\s+)?etiquetas?\s+(?:estao|estavam|esto|sao|sabe que estao)\s+errad[ao]s?\b/.test(normalized) ||
    /\betiquetas?\s+errad[ao]s?\b/.test(normalized);
}

function hasSingleObservationSignal(prompt: string): boolean {
  const normalized = normalizeForCompare(prompt);
  return /\b(?:apenas|somente|so)\s+(?:1|uma|um)\b/.test(normalized) ||
    /\b(?:1|uma|um)\s+unic[ao]\b/.test(normalized);
}

function splitMixedLabel(label: string): [string, string] | null {
  const parts = cleanLabel(label)
    .split(/\s+(?:e|ou)\s+|\s*[+&/]\s*/i)
    .map(cleanLabel)
    .filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  return [parts[0], parts[1]];
}

function sameLabel(a: string, b: string): boolean {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

function findSingleLabel(labels: string[], target: string): string {
  return labels.find((label) => sameLabel(label, target)) || target;
}

export function solveClosedConstraintDeduction(
  input: ClosedConstraintSolverInput,
): ClosedConstraintSolverResult {
  const prompt = `${input.prompt || ""}`;
  const labels = (input.labels?.length ? input.labels : extractLabelsFromPrompt(prompt))
    .map(cleanLabel)
    .filter(Boolean);
  const mixed = labels
    .map((label) => ({ label, parts: splitMixedLabel(label) }))
    .find((candidate) => candidate.parts);

  const issues: string[] = [];
  if (!hasAllLabelsWrongSignal(prompt)) {
    issues.push("missing_all_labels_wrong_signal");
  }
  if (!hasSingleObservationSignal(prompt)) {
    issues.push("missing_single_observation_signal");
  }
  if (!mixed?.parts) {
    issues.push("missing_mixed_label");
  }
  if (labels.length < 3) {
    issues.push("insufficient_labels");
  }

  if (issues.length > 0 || !mixed?.parts) {
    return {
      recognized: false,
      pattern: "unsupported",
      confidence: Math.max(0, 0.45 - issues.length * 0.08),
      action: null,
      conclusions: [],
      steps: [],
      extractedLabels: labels,
      issues,
    };
  }

  const [firstItem, secondItem] = mixed.parts;
  const firstLabel = findSingleLabel(labels, firstItem);
  const secondLabel = findSingleLabel(labels, secondItem);
  const mixedLabel = mixed.label;
  const action = `Retire a unica amostra permitida da caixa rotulada "${mixedLabel}".`;
  const firstCase = `Se sair "${firstItem}", a caixa "${mixedLabel}" contem apenas "${firstItem}", a caixa "${secondLabel}" contem "${mixedLabel}" e a caixa "${firstLabel}" contem apenas "${secondItem}".`;
  const secondCase = `Se sair "${secondItem}", a caixa "${mixedLabel}" contem apenas "${secondItem}", a caixa "${firstLabel}" contem "${mixedLabel}" e a caixa "${secondLabel}" contem apenas "${firstItem}".`;

  return {
    recognized: true,
    pattern: "all-labels-wrong-single-mixed-observation",
    confidence: 0.92,
    action,
    conclusions: [firstCase, secondCase],
    steps: [
      `Como todas as etiquetas estao erradas, a caixa rotulada "${mixedLabel}" nao pode conter a mistura indicada pelo proprio rotulo.`,
      `Logo, essa caixa so pode conter um dos dois itens simples: "${firstItem}" ou "${secondItem}".`,
      "A unica amostra permitida deve ser feita nessa caixa, porque ela determina um conteudo simples com certeza.",
      "Depois disso, as duas caixas restantes sao determinadas por eliminacao e pela regra de que seus rotulos tambem estao errados.",
    ],
    extractedLabels: labels,
    issues: [],
  };
}
