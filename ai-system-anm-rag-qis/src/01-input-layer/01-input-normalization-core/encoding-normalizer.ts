export interface EncodingNormalizerInput {
  text: string;
}

export interface EncodingNormalizerOutput {
  text: string;
  hadEncodingNoise: boolean;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

const GARBLED_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u00C3\u00A1/g, "\u00E1"],
  [/\u00C3\u00A0/g, "\u00E0"],
  [/\u00C3\u00A2/g, "\u00E2"],
  [/\u00C3\u00A3/g, "\u00E3"],
  [/\u00C3\u00A4/g, "\u00E4"],
  [/\u00C3\u00A9/g, "\u00E9"],
  [/\u00C3\u00AA/g, "\u00EA"],
  [/\u00C3\u00A8/g, "\u00E8"],
  [/\u00C3\u00AD/g, "\u00ED"],
  [/\u00C3\u00AC/g, "\u00EC"],
  [/\u00C3\u00B3/g, "\u00F3"],
  [/\u00C3\u00B4/g, "\u00F4"],
  [/\u00C3\u00B5/g, "\u00F5"],
  [/\u00C3\u00B6/g, "\u00F6"],
  [/\u00C3\u00BA/g, "\u00FA"],
  [/\u00C3\u00BC/g, "\u00FC"],
  [/\u00C3\u00A7/g, "\u00E7"],
  [/\u00C3\u0081/g, "\u00C1"],
  [/\u00C3\u0089/g, "\u00C9"],
  [/\u00C3\u008D/g, "\u00CD"],
  [/\u00C3\u0093/g, "\u00D3"],
  [/\u00C3\u009A/g, "\u00DA"],
  [/\u00C3\u0087/g, "\u00C7"],
  [/\u00E2\u0080\u0093/g, "-"],
  [/\u00E2\u0080\u0094/g, "-"],
  [/\u00E2\u0080\u0098/g, "'"],
  [/\u00E2\u0080\u0099/g, "'"],
  [/\u00E2\u0080\u009C/g, "\""],
  [/\u00E2\u0080\u009D/g, "\""],
  [/\u00E2\u0080\u00A6/g, "..."],
  [/\u00C2/g, ""],
];

export function encodingNormalizer(input: EncodingNormalizerInput): EncodingNormalizerOutput {
  let text = input.text || "";
  const original = text;
  for (const [pattern, replacement] of GARBLED_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  const hadEncodingNoise = text !== original;

  return {
    text,
    hadEncodingNoise,
    ok: true,
    component: "encoding-normalizer",
    score: hadEncodingNoise ? 0.75 : 0.9,
    detail: text,
    context: {
      hadEncodingNoise,
    },
  };
}
