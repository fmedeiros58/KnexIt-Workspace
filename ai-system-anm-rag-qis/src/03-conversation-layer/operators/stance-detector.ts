/**
 * @file stance-detector.ts
 * @description Detecta posicao discursiva basica do usuario no turno atual.
 * @layer 03-conversation-layer
 * @purpose Apoiar contraponto proporcional e continuidade dialogica.
 * @inputs Texto normalizado do usuario.
 * @outputs StanceDetectionResult.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy contexto, politicas dialeticas e futuros validadores dialogicos.
 * @invariants Nao deve transformar postura detectada em verdade factual.
 * @notes Heuristica leve para manter a conversa responsiva sem custo alto.
 */
export interface StanceDetectionResult {
  stance: "assertive" | "questioning" | "challenging" | "uncertain" | "neutral";
  confidence: number;
  signals: string[];
}

export function detectStance(text: string): StanceDetectionResult {
  const signals: string[] = [];
  if (/\?/.test(text)) signals.push("question_mark");
  if (/\b(discordo|nao concordo|conteste|critique|refute)\b/i.test(text)) signals.push("challenge");
  if (/\b(acho|talvez|nao sei|incerto)\b/i.test(text)) signals.push("uncertainty");
  if (/\b(afirmo|tenho certeza|com certeza)\b/i.test(text)) signals.push("assertion");
  const stance =
    signals.includes("challenge") ? "challenging" :
      signals.includes("uncertainty") ? "uncertain" :
        signals.includes("question_mark") ? "questioning" :
          signals.includes("assertion") ? "assertive" : "neutral";
  return { stance, confidence: signals.length ? 0.72 : 0.42, signals };
}

