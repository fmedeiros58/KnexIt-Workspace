/**
 * Responsabilidade do arquivo:
 * - Mapear estrutura local do turno em classe discursiva resumida.
 * - Identificar formatos como pedido+restricao ou multiplas afirmacoes.
 * - Entregar shape util para o conversation-layer sem sobreposicao de funcoes.
 */
import { sentenceBoundaryDetector } from "./sentence-boundary-detector";

export interface DialogueStructureDetectorInput {
  text: string;
}

export interface DialogueStructureDetectorResult {
  dialogueShape: "single-turn" | "multi-claim" | "request-then-constraint" | "other";
}

export function dialogueStructureDetector(input: DialogueStructureDetectorInput): DialogueStructureDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  const sentences = sentenceBoundaryDetector({ text: input.text }).sentences;

  if (sentences.length <= 1) return { dialogueShape: "single-turn" };
  if (/\b(preciso|quero|ajuste|implemente)\b/.test(text) && /\b(mas|porem|sem|com)\b/.test(text)) {
    return { dialogueShape: "request-then-constraint" };
  }
  if (sentences.length >= 3) return { dialogueShape: "multi-claim" };
  return { dialogueShape: "other" };
}

