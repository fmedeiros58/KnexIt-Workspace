type FrancTuple = [string, number];

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function detectIso3(text: string) {
  const normalized = normalize(text);
  if (!normalized || normalized.length < 12) return "und";
  if (/\b(the|with|please|analysis|review|limitations|this|answer|english|should|and)\b/.test(normalized)) return "eng";
  if (/\b(que|com|analise|detalhada|dissertacao|resposta)\b/.test(normalized)) return "por";
  if (/\b(el|la|analisis|documento|respuesta)\b/.test(normalized)) return "spa";
  return "und";
}

export function franc(text: string, _options?: { minLength?: number }) {
  return detectIso3(text);
}

export function francAll(text: string, _options?: { minLength?: number }): FrancTuple[] {
  const detected = detectIso3(text);
  if (detected === "eng") return [["eng", 0.93], ["por", 0.51], ["spa", 0.49]];
  if (detected === "por") return [["por", 0.94], ["spa", 0.52], ["eng", 0.48]];
  if (detected === "spa") return [["spa", 0.92], ["por", 0.58], ["eng", 0.47]];
  return [["und", 0.2], ["por", 0.18], ["eng", 0.17]];
}
