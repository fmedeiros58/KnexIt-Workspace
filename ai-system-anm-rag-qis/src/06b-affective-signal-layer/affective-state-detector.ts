/**
 * ai-system-anm
 * Detecta o afeto predominante sem alterar semantica de conteudo.
 */
export type DetectedAffect = "neutral" | "frustrated" | "anxious" | "enthusiastic" | "concerned" | "calm";

function normalize(text: string) {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function detectAffectiveState(text: string): { dominantAffect: DetectedAffect; markers: string[] } {
  const normalized = normalize(text);
  const markers: string[] = [];

  if (/\b(frustrad|irritad|raiva|indignad|de novo|nao funciona|nao funcionou)\b/.test(normalized)) {
    markers.push("frustration_marker");
    return { dominantAffect: "frustrated", markers };
  }

  if (/\b(ansios|preocupad|nervos|urgente|desesperad|medo)\b/.test(normalized)) {
    markers.push("anxiety_marker");
    return { dominantAffect: "anxious", markers };
  }

  if (/\b(perfeito|otimo|excelente|maravilha|legal|show|boa)\b/.test(normalized)) {
    markers.push("enthusiasm_marker");
    return { dominantAffect: "enthusiastic", markers };
  }

  if (/\b(duvida|incerteza|nao tenho certeza|nao sei)\b/.test(normalized)) {
    markers.push("concern_marker");
    return { dominantAffect: "concerned", markers };
  }

  if (/\b(obrigado|valeu|tranquilo|calma|de boa)\b/.test(normalized)) {
    markers.push("calm_marker");
    return { dominantAffect: "calm", markers };
  }

  return { dominantAffect: "neutral", markers };
}
