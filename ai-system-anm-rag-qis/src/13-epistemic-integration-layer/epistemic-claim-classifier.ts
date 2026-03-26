/**
 * Responsabilidade do arquivo:
 * - Classificar segmentos como fato, inferencia, hipotese, especulacao ou questao aberta.
 * - Fornecer base para auditoria epistemica na camada 13.
 * - Evitar que toda frase seja tratada com o mesmo status de certeza.
 */
export type EpistemicClaimKind = "fact" | "inference" | "hypothesis" | "speculation" | "open_question";

export interface EpistemicClaim {
  id: string;
  text: string;
  kind: EpistemicClaimKind;
  confidence: number;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function classifyKind(text: string): EpistemicClaimKind {
  const normalized = normalize(text);
  if (!normalized) return "speculation";
  if (/\?$/.test(text.trim()) || /\b(seria|como|por que|qual)\b/.test(normalized)) return "open_question";
  if (/\b(hipotese|pode ser|talvez|admite se|possivelmente)\b/.test(normalized)) return "hypothesis";
  if (/\b(indica|sugere|implica|portanto|logo|assim)\b/.test(normalized)) return "inference";
  if (/\b(sem duvida|com certeza absoluta|garantidamente|100%)\b/.test(normalized)) return "speculation";
  if (/\b(dado|confirmado|fonte|evidencia|registro|observou se)\b/.test(normalized)) return "fact";
  if (/\b(acho|parece|imagino)\b/.test(normalized)) return "speculation";
  return "inference";
}

function scoreByKind(kind: EpistemicClaimKind) {
  if (kind === "fact") return 0.82;
  if (kind === "inference") return 0.64;
  if (kind === "hypothesis") return 0.54;
  if (kind === "open_question") return 0.48;
  return 0.32;
}

export function classifyEpistemicClaims(text: string, maxClaims = 18): EpistemicClaim[] {
  const parts = `${text || ""}`
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxClaims);

  return parts.map((part, index) => {
    const kind = classifyKind(part);
    return {
      id: `claim-${index + 1}`,
      text: part,
      kind,
      confidence: clamp01(scoreByKind(kind)),
    };
  });
}

