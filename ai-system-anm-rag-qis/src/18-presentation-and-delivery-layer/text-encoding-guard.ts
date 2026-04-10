/**
 * Responsabilidade do arquivo:
 * - Corrigir artefatos comuns de mojibake na saida textual final.
 * - Padronizar a entrega UTF-8 no ultimo estagio antes do payload.
 * - Sinalizar quando houve reparo para rastreabilidade no trace.
 */
import { decodeLikelyMojibake } from "../shared/text-processing/mojibake-core";

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
  ["\u00E2\u0080\u0093", "–"],
  ["\u00E2\u0080\u0094", "—"],
  ["\u00E2\u0080\u0098", "‘"],
  ["\u00E2\u0080\u0099", "’"],
  ["\u00E2\u0080\u009C", "“"],
  ["\u00E2\u0080\u009D", "”"],
  ["\u00E2\u0080\u00A6", "…"],
  ["\u00C2", ""],
];

const REPLACEMENT_CHAR_WORD_REPAIRS: ReadonlyArray<[RegExp, string]> = [
  [/Intelig\uFFFDncia/g, "Inteligência"],
  [/intelig\uFFFDncia/g, "inteligência"],
  [/padr\uFFFDes/g, "padrões"],
  [/infer\uFFFDncias/g, "inferências"],
  [/J\uFFFD(?=\s|$)/g, "Já"],
  [/j\uFFFD(?=\s|$)/g, "já"],
  [/mem\uFFFDria/g, "memória"],
  [/percep\uFFFD\uFFFDo/g, "percepção"],
  [/racioc\uFFFDnio/g, "raciocínio"],
  [/l\uFFFDgico/g, "lógico"],
  [/l\uFFFDgica/g, "lógica"],
  [/refere-se\s+\uFFFDs/g, "refere-se às"],
  [/adapta\uFFFD\uFFFDo/g, "adaptação"],
  [/tr�s/gi, "três"],
  [/princ�pios/gi, "princípios"],
  [/contradi��o/gi, "contradição"],
  [/inconsist�ncia/gi, "inconsistência"],
  [/exce��o/gi, "exceção"],
  [/situa��es/gi, "situações"],
  [/filosoficas/gi, "filosóficas"],
  [/decis�o/gi, "decisão"],
  [/conclus�o/gi, "conclusão"],
];

const PT_DIACRITIC_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\bleticia\b/g, "let\u00EDcia"],
  [/\bLeticia\b/g, "Let\u00EDcia"],
  [/\bLETICIA\b/g, "LET\u00CDCIA"],
  [/\bcognicao\b/g, "cogni\u00E7\u00E3o"],
  [/\binteracao\b/g, "intera\u00E7\u00E3o"],
  [/\bassistencia\b/g, "assist\u00EAncia"],
  [/\btecnica\b/g, "t\u00E9cnica"],
  [/\bvinculo\b/g, "v\u00EDnculo"],
  [/\bdimensao\b/g, "dimens\u00E3o"],
  [/\bformulacao\b/g, "formula\u00E7\u00E3o"],
  [/\bcomposicao\b/g, "composi\u00E7\u00E3o"],
  [/\bdissertacao\b/g, "disserta\u00E7\u00E3o"],
  [/\bdedicatoria\b/g, "dedicat\u00F3ria"],
  [/\bprecisao\b/g, "precis\u00E3o"],
  [/\binvencoes\b/g, "inven\u00E7\u00F5es"],
  [/\bmitologicas\b/g, "mitol\u00F3gicas"],
  [/\bproposito\b/g, "prop\u00F3sito"],
  [/\breune\b/g, "re\u00FAne"],
  [/\bsintese\b/g, "s\u00EDntese"],
  [/\bessencia\b/g, "ess\u00EAncia"],
  [/\brazao\b/g, "raz\u00E3o"],
  [/\balem\b/g, "al\u00E9m"],
  [/\bhistoria\b/g, "hist\u00F3ria"],
  [/\bintencao\b/g, "inten\u00E7\u00E3o"],
  [/\bdirecao\b/g, "dire\u00E7\u00E3o"],
  [/\bfuncao\b/g, "fun\u00E7\u00E3o"],
  [/\bcompreensao\b/g, "compreens\u00E3o"],
  [/\bcarater\b/g, "car\u00E1ter"],
  [/\bnao\b/g, "n\u00E3o"],
  [/\bNao\b/g, "N\u00E3o"],
  [/\btambem\b/g, "tamb\u00E9m"],
  [/\bTambem\b/g, "Tamb\u00E9m"],
  [/\bha\b/g, "h\u00E1"],
  [/\bHa\b/g, "H\u00E1"],
  [/\binformacao\b/g, "informa\u00E7\u00E3o"],
  [/\bverificacao\b/g, "verifica\u00E7\u00E3o"],
  [/\bvoce\b/g, "voc\u00EA"],
  [/\bVoce\b/g, "Voc\u00EA"],
  [/\bpor tras\b/g, "por tr\u00E1s"],
  [/\bPor tras\b/g, "Por tr\u00E1s"],
];

const PT_CONTEXTUAL_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\b([Mm]eu nome)\s+e\s+/g, "$1 \u00E9 "],
  [/\b([Oo] nome)\s+e\s+/g, "$1 \u00E9 "],
  [/\b([Ll]eticia|[Ll]et\u00EDcia)\s+e\s+um\b/g, "$1 \u00E9 um"],
  [/\b([Ll]eticia|[Ll]et\u00EDcia)\s+e\s+uma\b/g, "$1 \u00E9 uma"],
  [/\b([Mm]edeiros)\s+e\s+o\b/g, "$1 \u00E9 o"],
  [/\b([Mm]edeiros)\s+e\s+a\b/g, "$1 \u00E9 a"],
  [/\b([Ii]sso)\s+e\s+/g, "$1 \u00E9 "],
];

const PT_QUESTION_COPULA_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\b([Qq]ual)\s+e\b/g, "$1 \u00E9"],
  [/\b([Qq]uem)\s+e\b/g, "$1 \u00E9"],
  [/\b([Cc]omo)\s+e\b/g, "$1 \u00E9"],
  [/\b([Oo]nde)\s+e\b/g, "$1 \u00E9"],
  [/\b([Oo]\s+que)\s+e\b/g, "$1 \u00E9"],
];

const PT_CANONICAL_ACCENT_DICTIONARY: ReadonlyMap<string, string> = new Map<string, string>([
  ["leticia", "let\u00EDcia"],
  ["proposito", "prop\u00F3sito"],
  ["reune", "re\u00FAne"],
  ["teorico", "te\u00F3rico"],
  ["teorica", "te\u00F3rica"],
  ["epistemologico", "epistemol\u00F3gico"],
  ["epistemologica", "epistemol\u00F3gica"],
  ["semantico", "sem\u00E2ntico"],
  ["semantica", "sem\u00E2ntica"],
  ["ortografico", "ortogr\u00E1fico"],
  ["ortografica", "ortogr\u00E1fica"],
  ["linguistico", "lingu\u00EDstico"],
  ["linguistica", "lingu\u00EDstica"],
  ["sistemico", "sist\u00EAmico"],
  ["sistemica", "sist\u00EAmica"],
  ["logico", "l\u00F3gico"],
  ["logica", "l\u00F3gica"],
  ["metodo", "m\u00E9todo"],
  ["metodos", "m\u00E9todos"],
  ["criterio", "crit\u00E9rio"],
  ["criterios", "crit\u00E9rios"],
  ["estrategia", "estrat\u00E9gia"],
  ["estrategias", "estrat\u00E9gias"],
  ["relatorio", "relat\u00F3rio"],
  ["relatorios", "relat\u00F3rios"],
  ["numero", "n\u00FAmero"],
  ["numeros", "n\u00FAmeros"],
  ["periodo", "per\u00EDodo"],
  ["periodos", "per\u00EDodos"],
  ["historico", "hist\u00F3rico"],
  ["historica", "hist\u00F3rica"],
  ["academico", "acad\u00EAmico"],
  ["academica", "acad\u00EAmica"],
  ["cientifico", "cient\u00EDfico"],
  ["cientifica", "cient\u00EDfica"],
  ["biologico", "biol\u00F3gico"],
  ["biologica", "biol\u00F3gica"],
  ["psicologico", "psicol\u00F3gico"],
  ["psicologica", "psicol\u00F3gica"],
  ["pedagogico", "pedag\u00F3gico"],
  ["pedagogica", "pedag\u00F3gica"],
  ["basico", "b\u00E1sico"],
  ["basica", "b\u00E1sica"],
  ["tecnico", "t\u00E9cnico"],
  ["tecnica", "t\u00E9cnica"],
  ["tecnicos", "t\u00E9cnicos"],
  ["tecnicas", "t\u00E9cnicas"],
  ["nao", "n\u00E3o"],
  ["voce", "voc\u00EA"],
  ["tambem", "tamb\u00E9m"],
  ["ha", "h\u00E1"],
  ["alem", "al\u00E9m"],
  ["atraves", "atrav\u00E9s"],
  ["sintese", "s\u00EDntese"],
  ["essencia", "ess\u00EAncia"],
  ["razao", "raz\u00E3o"],
  ["intencao", "inten\u00E7\u00E3o"],
  ["direcao", "dire\u00E7\u00E3o"],
  ["funcao", "fun\u00E7\u00E3o"],
  ["compreensao", "compreens\u00E3o"],
  ["carater", "car\u00E1ter"],
]);

function applyCaseTemplate(source: string, replacement: string): string {
  if (!source) return replacement;
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  const startsUpper = source[0] === source[0].toUpperCase();
  if (!startsUpper) return replacement;
  return `${replacement[0]?.toUpperCase() || ""}${replacement.slice(1)}`;
}

function applyCanonicalAccentDictionary(text: string): string {
  return `${text || ""}`.replace(/\b[\p{L}]{2,}\b/gu, (word) => {
    const normalized = word.toLocaleLowerCase("pt-BR");
    const canonical = PT_CANONICAL_ACCENT_DICTIONARY.get(normalized);
    if (!canonical) return word;
    return applyCaseTemplate(word, canonical);
  });
}

function isProtectedSegment(segment: string): boolean {
  if (!segment) return false;
  if (segment.startsWith("```")) return true;
  if (segment.startsWith("`") && segment.endsWith("`")) return true;
  if (/^\s*https?:\/\//i.test(segment)) return true;
  if (/^\s*www\./i.test(segment)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(segment.trim())) return true;
  if (/^[A-Za-z]:\\/.test(segment.trim())) return true;
  if (/^\/[A-Za-z0-9._/-]+$/.test(segment.trim())) return true;
  return false;
}

function mapOutsideProtectedCode(text: string, mapper: (segment: string) => string): string {
  if (!text) return "";
  const segments = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return segments
    .map((segment) => {
      if (!segment) return segment;
      if (isProtectedSegment(segment)) return segment;
      return mapper(segment);
    })
    .join("");
}

function normalizeSurfaceWhitespace(text: string): string {
  return `${text || ""}`
    .replace(/\uFEFF/g, "")
    .replace(/[\u200B-\u200D]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function uppercaseFirstLetter(text: string): string {
  return `${text || ""}`.replace(/^(\s*)([\p{Ll}])/u, (_match, leading: string, letter: string) => {
    return `${leading}${letter.toLocaleUpperCase("pt-BR")}`;
  });
}

function stripIdentitySelfAddressLead(text: string): string {
  const original = `${text || ""}`;
  let updated = original;

  updated = updated.replace(
    /^\s*(?:ol[aá],?\s*)?(?:eu\s+(?:sou|me\s+chamo)\s+a\s+)?(?:let[ií]cia|let\S{0,3}cia)\s*,?\s*aqui\b\s*[:\-]\s*/gimu,
    "",
  );
  updated = updated.replace(
    /^\s*(?:ol[aá],?\s*)?(?:let[ií]cia|let\S{0,3}cia)\s*,?\s*aqui\b[.!?]\s*/gimu,
    "",
  );
  updated = updated.replace(
    /^\s*(?:eu\s+sou\s+a\s+)?(?:ia\s+)?(?:let[ií]cia|let\S{0,3}cia)\s*,?\s+aqui\b\s*[:\-]\s*/gimu,
    "",
  );

  const trimmed = updated.trimStart();
  if (trimmed === original.trimStart()) return trimmed;
  return uppercaseFirstLetter(trimmed);
}

function shouldApplyPortugueseDiacriticRepair(value: string): boolean {
  const normalized = `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;

  return /\b(leticia|medeiros|language-engineered technology|cognicao|interacao|assistencia|arquitetura tecnica|vinculo humano|proposito|reune|sintese|essencia|razao|alem|historia|intencao|direcao|funcao|compreensao|carater|se chama|qual e o seu nome|meu nome e)\b/.test(
    normalized,
  );
}

function containsStrongMojibakeSignal(text: string): boolean {
  return /(?:Ã.|â\u0080|\uFFFD|�)/.test(text);
}

function containsTranscriptLabels(text: string): boolean {
  return /\b(?:usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*[:\-]/i.test(text);
}

function stripTranscriptLabels(text: string): string {
  return `${text || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*[:\-]\s*/gi, "\n")
    .trim();
}

export function ensureUtf8Response(text: string): Utf8GuardResult {
  const original = `${text || ""}`;
  let repaired = decodeLikelyMojibake(original);

  for (const [from, to] of MOJIBAKE_REPLACEMENTS) {
    if (!repaired.includes(from)) continue;
    repaired = repaired.split(from).join(to);
  }

  if (repaired.includes("\uFFFD") || repaired.includes("�")) {
    for (const [pattern, replacement] of REPLACEMENT_CHAR_WORD_REPAIRS) {
      repaired = repaired.replace(pattern, replacement);
    }
  }

  const mojibakeChanged = repaired !== original;
  const shouldApplyPt =
    containsStrongMojibakeSignal(original) ||
    containsStrongMojibakeSignal(repaired) ||
    mojibakeChanged ||
    shouldApplyPortugueseDiacriticRepair(repaired);

  if (shouldApplyPt) {
    repaired = mapOutsideProtectedCode(repaired, (segment) => {
      let updated = segment;

      for (const [pattern, replacement] of PT_DIACRITIC_REPLACEMENTS) {
        updated = updated.replace(pattern, replacement);
      }

      updated = applyCanonicalAccentDictionary(updated);

      for (const [pattern, replacement] of PT_CONTEXTUAL_REPLACEMENTS) {
        updated = updated.replace(pattern, replacement);
      }

      for (const [pattern, replacement] of PT_QUESTION_COPULA_REPLACEMENTS) {
        updated = updated.replace(pattern, replacement);
      }

      return updated;
    });
  }

  if (containsTranscriptLabels(repaired)) {
    repaired = stripTranscriptLabels(repaired);
  }

  repaired = mapOutsideProtectedCode(repaired, (segment) => stripIdentitySelfAddressLead(segment));
  repaired = normalizeSurfaceWhitespace(repaired);

  return {
    text: repaired,
    repaired: repaired !== original,
  };
}