/**
 * Responsabilidade do arquivo:
 * - Extrair ideia nuclear e objetivo de interacao a partir da mensagem.
 * - Sinalizar ambiguidades iniciais para orientar elaboracao conjunta.
 * - Produzir seed deterministica para os componentes seguintes.
 */
import type { CommunicativeElaborationInput, IdeaSeed } from "./communicative-elaboration.types";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferUserGoal(message: string) {
  const normalized = normalize(message);
  if (/\b(resuma|sintese|resumo)\b/.test(normalized)) return "sintetizar";
  if (/\b(analise|avali(e|ar)|critique|critica)\b/.test(normalized)) return "analisar_criticamente";
  if (/\b(explique|entenda|compreenda)\b/.test(normalized)) return "explicar";
  if (/\b(refine|refinar|melhore|ajuste|aprofunde)\b/.test(normalized)) return "refinar";
  if (/\b(escreva|redija|crie)\b/.test(normalized)) return "produzir_texto";
  return "explorar_ideia";
}

export function extractIdeaSeed(input: CommunicativeElaborationInput): IdeaSeed {
  const normalized = normalize(input.message);
  const clauses = `${input.message || ""}`
    .split(/[.?!]\s+|;|:\s+/g)
    .map((item) => item.trim())
    .filter(Boolean);
  const coreClaim = clauses[0] || input.message.trim() || "Questao sem formulacao explicita.";
  const userGoal = inferUserGoal(input.message);

  const ambiguityNotes: string[] = [];
  if (normalized.length < 18) ambiguityNotes.push("pedido_curto");
  if (/\b(isso|esse|essa|aquilo)\b/.test(normalized)) ambiguityNotes.push("referencia_deitica_sem_ancora");
  if (!/\b(que|como|por que|qual|quem|onde|quando)\b/.test(normalized) && clauses.length <= 1) {
    ambiguityNotes.push("pedido_pouco_perguntivo");
  }

  const confidence = clamp01(
    0.74 -
      (ambiguityNotes.length * 0.14) +
      (input.grounding ? input.grounding.confidence * 0.2 : 0) +
      (input.activeContext.length > 0 ? 0.06 : 0),
  );

  return {
    coreClaim,
    userGoal,
    confidence,
    ambiguityNotes,
  };
}
