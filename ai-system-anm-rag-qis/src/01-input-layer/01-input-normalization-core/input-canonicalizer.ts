export interface InputCanonicalizerInput {
  text: string;
}

export interface InputCanonicalizerOutput {
  text: string;
  changed: boolean;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function inputCanonicalizer(input: InputCanonicalizerInput): InputCanonicalizerOutput {
  const original = input.text || "";
  const canonical = original
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[…]/g, "...")
    .replace(/[–—]/g, "-");

  return {
    text: canonical,
    changed: canonical !== original,
    ok: true,
    component: "input-canonicalizer",
    score: canonical.trim().length ? 0.82 : 0.1,
    detail: canonical,
    context: {
      changed: canonical !== original,
    },
  };
}
