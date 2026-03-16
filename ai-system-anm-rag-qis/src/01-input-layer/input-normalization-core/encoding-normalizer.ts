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
  [/Ã¡/g, "á"],
  [/Ã©/g, "é"],
  [/Ã­/g, "í"],
  [/Ã³/g, "ó"],
  [/Ãº/g, "ú"],
  [/Ã£/g, "ã"],
  [/Ãµ/g, "õ"],
  [/Ã§/g, "ç"],
  [/Ãª/g, "ê"],
  [/Ã´/g, "ô"],
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
