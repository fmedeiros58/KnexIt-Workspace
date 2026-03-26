/**
 * Responsabilidade do arquivo:
 * - Corrigir artefatos comuns de mojibake na saida textual final.
 * - Padronizar a entrega UTF-8 no ultimo estagio antes do payload.
 * - Sinalizar quando houve reparo para rastreabilidade no trace.
 */
export interface Utf8GuardResult {
  text: string;
  repaired: boolean;
}

const MOJIBAKE_REPLACEMENTS: ReadonlyArray<[string, string]> = [
  ["\u00C3\u00A1", "\u00E1"],
  ["\u00C3\u00A0", "\u00E0"],
  ["\u00C3\u00A2", "\u00E2"],
  ["\u00C3\u00A3", "\u00E3"],
  ["\u00C3\u00A4", "\u00E4"],
  ["\u00C3\u00A9", "\u00E9"],
  ["\u00C3\u00AA", "\u00EA"],
  ["\u00C3\u00A8", "\u00E8"],
  ["\u00C3\u00AD", "\u00ED"],
  ["\u00C3\u00AC", "\u00EC"],
  ["\u00C3\u00B3", "\u00F3"],
  ["\u00C3\u00B4", "\u00F4"],
  ["\u00C3\u00B5", "\u00F5"],
  ["\u00C3\u00B6", "\u00F6"],
  ["\u00C3\u00BA", "\u00FA"],
  ["\u00C3\u00BC", "\u00FC"],
  ["\u00C3\u00A7", "\u00E7"],
  ["\u00C3\u0081", "\u00C1"],
  ["\u00C3\u0089", "\u00C9"],
  ["\u00C3\u008D", "\u00CD"],
  ["\u00C3\u0093", "\u00D3"],
  ["\u00C3\u009A", "\u00DA"],
  ["\u00C3\u0087", "\u00C7"],
  ["\u00E2\u0080\u0093", "-"],
  ["\u00E2\u0080\u0094", "-"],
  ["\u00E2\u0080\u0098", "'"],
  ["\u00E2\u0080\u0099", "'"],
  ["\u00E2\u0080\u009C", "\""],
  ["\u00E2\u0080\u009D", "\""],
  ["\u00E2\u0080\u00A6", "..."],
  ["\u00C2", ""],
];

const PT_DIACRITIC_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\bcognicao\b/g, "cognição"],
  [/\binteracao\b/g, "interação"],
  [/\bassistencia\b/g, "assistência"],
  [/\btecnica\b/g, "técnica"],
  [/\bvinculo\b/g, "vínculo"],
  [/\bdimensao\b/g, "dimensão"],
  [/\bformulacao\b/g, "formulação"],
  [/\bcomposicao\b/g, "composição"],
  [/\bdissertacao\b/g, "dissertação"],
  [/\bdedicatoria\b/g, "dedicatória"],
  [/\bprecisao\b/g, "precisão"],
  [/\binvencoes\b/g, "invenções"],
  [/\bmitologicas\b/g, "mitológicas"],
  [/\bnao\b/g, "não"],
  [/\binformacao\b/g, "informação"],
  [/\bverificacao\b/g, "verificação"],
  [/\bvoce\b/g, "você"],
  [/\bVoce\b/g, "Você"],
];

function shouldApplyPortugueseDiacriticRepair(value: string): boolean {
  const normalized = `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return /\b(leticia|medeiros|language-engineered technology|cognicao|interacao|assistencia|arquitetura tecnica|vinculo humano)\b/.test(
    normalized,
  );
}

export function ensureUtf8Response(text: string): Utf8GuardResult {
  const original = `${text || ""}`;
  let repaired = original;

  for (const [from, to] of MOJIBAKE_REPLACEMENTS) {
    if (!repaired.includes(from)) continue;
    repaired = repaired.split(from).join(to);
  }
  const mojibakeChanged = repaired !== original;
  if (mojibakeChanged || shouldApplyPortugueseDiacriticRepair(repaired)) {
    for (const [pattern, replacement] of PT_DIACRITIC_REPLACEMENTS) {
      repaired = repaired.replace(pattern, replacement);
    }
  }

  return {
    text: repaired,
    repaired: repaired !== original,
  };
}

