const UI_FONT_MARKERS = [
  "ui-sans-serif",
  "system-ui",
  "-apple-system",
  "blinkmacsystemfont",
  "inter",
];

const FONT_MAPPINGS: Array<{
  pattern: RegExp;
  family: string;
}> = [
  {
    pattern: /times|timesnewroman|times-roman|tnr|georgia|garamond|cambria|serif/i,
    family: '"Times New Roman", Times, serif',
  },
  {
    pattern: /courier|couriernew|courier-new|consolas|monaco|mono|fixed/i,
    family: '"Courier New", Courier, monospace',
  },
  {
    pattern: /arial|helvetica|helv|liberationsans/i,
    family: 'Arial, Helvetica, sans-serif',
  },
  {
    pattern: /calibri|segoe|verdana|tahoma/i,
    family: 'Calibri, Arial, Helvetica, sans-serif',
  },
  {
    pattern: /symbol/i,
    family: 'Symbol, "Times New Roman", serif',
  },
  {
    pattern: /zapfdingbats|dingbats/i,
    family: 'ZapfDingbats, Symbol, serif',
  },
];

function normalizeFontToken(value: string): string {
  return value
    .replace(/^[A-Z]{6}\+/, "")
    .replace(/PSMT|MT|CIDFont|Identity-H|Identity V/gi, "")
    .replace(/[,_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isUiFontFamily(fontFamily: string | null | undefined): boolean {
  const value = fontFamily?.toLowerCase() ?? "";

  return UI_FONT_MARKERS.some((marker) => value.includes(marker));
}

export function isGenericPdfFontFamily(
  fontFamily: string | null | undefined,
): boolean {
  const value = fontFamily?.trim().toLowerCase();

  return (
    !value ||
    value === "serif" ||
    value === "sans-serif" ||
    value === "monospace" ||
    value === "arial, sans-serif" ||
    value === "arial, helvetica, sans-serif" ||
    isUiFontFamily(value)
  );
}

function looksLikePdfFontFamily(fontFamily: string): boolean {
  const value = fontFamily.trim().toLowerCase();

  if (!value) return false;
  if (isGenericPdfFontFamily(value)) return false;
  if (isUiFontFamily(value)) return false;

  return true;
}

export function resolvePdfFontFamily(input: {
  fontFamily?: string | null;
  fontName?: string | null;
  text?: string;
}): string {
  const fontName = normalizeFontToken(input.fontName ?? "");
  const rawFontFamily = input.fontFamily?.trim() ?? "";
  const fontFamily = normalizeFontToken(rawFontFamily);
  const lookup = `${fontName} ${fontFamily}`;

  for (const mapping of FONT_MAPPINGS) {
    if (mapping.pattern.test(lookup)) {
      return mapping.family;
    }
  }

  if (looksLikePdfFontFamily(fontFamily)) {
    return fontFamily;
  }

  if (/serif/i.test(fontName)) {
    return '"Times New Roman", Times, serif';
  }

  if (/mono|fixed/i.test(fontName)) {
    return '"Courier New", Courier, monospace';
  }

  /*
   * Fallback intencionalmente serifado.
   *
   * No Knexread, quando a fonte real do PDF não é conhecida, cair em
   * ui-sans-serif/system-ui ou em uma fonte da interface deixa o documento
   * com aparência de HTML comum. Para PDFs acadêmicos/institucionais, o
   * fallback serifado tende a ficar mais próximo da apresentação original.
   */
  return '"Times New Roman", Times, serif';
}
