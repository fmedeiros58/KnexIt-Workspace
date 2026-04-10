/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: proof-vs-illustration-detector.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Detectar se uma resposta com pretensão demonstrativa realmente apresenta
 *   sinais de prova/inferência, ou se substitui demonstração por ilustração,
 *   exemplos soltos ou replay do enunciado.
 *
 * Função no pipeline:
 * - Este arquivo NÃO prova formalmente uma tese.
 * - Este arquivo NÃO normaliza a resposta para entrega.
 * - Este arquivo NÃO decide sozinho o gate global.
 * - Este arquivo apenas estima a proporção entre sinais de prova
 *   e sinais de ilustração/replay.
 *
 * Garantias esperadas:
 * - Penalizar respostas que trocam demonstração por exemplo.
 * - Penalizar replay do prompt em tarefas que exigem demonstração.
 * - Produzir score simples, estável e auditável.
 */

export interface ProofVsIllustrationResult {
  score: number;
  passed: boolean;
  proofSignals: number;
  illustrationSignals: number;
  issues: string[];
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => `${item || ""}`.trim()).filter(Boolean)));
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((acc, pattern) => acc + (text.match(pattern)?.length || 0), 0);
}

function responseSentenceCount(text: string): number {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function lightLengthGuard(score: number, responseText: string): number {
  const length = `${responseText || ""}`.trim().length;
  const sentences = responseSentenceCount(responseText);

  if (length < 120 || sentences <= 1) {
    return Math.min(score, 0.42);
  }

  if (length < 220 || sentences <= 2) {
    return Math.min(score, 0.6);
  }

  return score;
}

export function detectProofVsIllustration(
  responseText: string,
  options?: { requiresDemonstration?: boolean },
): ProofVsIllustrationResult {
  const rawText = `${responseText || ""}`.trim();
  const normalized = normalize(rawText);

  if (!normalized) {
    return {
      score: 0,
      passed: false,
      proofSignals: 0,
      illustrationSignals: 0,
      issues: ["empty_response"],
    };
  }

  const requiresDemonstration = options?.requiresDemonstration || false;

  const proofSignals = countMatches(normalized, [
    /\b(se .* entao|if .* then)\b/g,
    /\b(implica|implies|deriva|derive|portanto|therefore|logo)\b/g,
    /\b(seja|let|predicado|predicate|conjunto|set|insatisfazibilidade|incompatibilidade)\b/g,
    /\b(impossibilidade|insatisfazibilidade|incompatibilidade|infeasible|cannot satisfy)\b/g,
    /\b(para todo|for all|existe|there exists)\b/g,
    /\b(premissa|premissas|conclusao|conclusão|decorre|segue que)\b/g,
    /\b(sob essas condicoes|sob essas condições|dado que|assuma|assumindo)\b/g,
  ]);

  const illustrationSignals = countMatches(normalized, [
    /\b(por exemplo|for example|exemplo|example)\b/g,
    /\b(imagine|analogia|analogy|caso concreto|concrete case)\b/g,
    /\b(uma lei que|a law that|historicamente|historical)\b/g,
    /\b(como se fosse|as if|pense em)\b/g,
  ]);

  const promptReplaySignals = countMatches(normalized, [
    /\b(consideremos um sistema social idealizado|considere um sistema social idealizado)\b/g,
    /\b(faremos o seguinte|agora suponha|sem recorrer inicialmente a autores)\b/g,
    /\b(regarding your question|to address the question|let me clarify some concepts)\b/g,
  ]);

  const denominator = Math.max(1, proofSignals + illustrationSignals + promptReplaySignals);
  let score = Math.max(0, Math.min(1, (proofSignals + 0.5) / denominator));
  score = lightLengthGuard(score, rawText);

  const issues: string[] = [];

  if (requiresDemonstration && proofSignals < 2) {
    issues.push("insufficient_proof_signals_for_demonstration");
  }

  if (requiresDemonstration && illustrationSignals > proofSignals) {
    issues.push("illustration_dominates_instead_of_proof");
  }

  if (requiresDemonstration && illustrationSignals > 0 && proofSignals === 0) {
    issues.push("demonstration_replaced_by_illustration");
  }

  if (requiresDemonstration && promptReplaySignals > 0) {
    issues.push("prompt_replay_detected_in_demonstration_section");
  }

  if (requiresDemonstration && proofSignals === 0 && promptReplaySignals > 0) {
    issues.push("demonstration_replaced_by_prompt_replay");
  }

  if (requiresDemonstration && score < 0.5) {
    issues.push("weak_proof_to_illustration_ratio");
  }

  return {
    score: Number(score.toFixed(4)),
    passed: issues.length === 0 || (score >= 0.7 && promptReplaySignals === 0),
    proofSignals,
    illustrationSignals,
    issues: uniqueStrings(issues),
  };
}