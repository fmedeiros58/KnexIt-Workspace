/**
 * Responsabilidade do arquivo:
 * - Detectar marcadores referenciais (pronomes, demonstrativos e anaforas simples).
 * - Entregar marcadores explicitos para apoiar continuidade textual.
 * - Limitar-se a rotulos de superficie sem resolver coreferencia completa.
 */
import type { ReferentialMarker } from "../types/language-signal-types";

export interface ReferentialMarkerDetectorInput {
  text: string;
}

export interface ReferentialMarkerDetectorResult {
  markers: ReferentialMarker[];
}

export function referentialMarkerDetector(input: ReferentialMarkerDetectorInput): ReferentialMarkerDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  const markers: ReferentialMarker[] = [];

  for (const marker of text.match(/\b(isso|essa|esse|aquilo|isto|this|that|it)\b/g) || []) {
    const kind: ReferentialMarker["kind"] = /^(it|this|that)$/.test(marker) ? "anaphora" : "demonstrative";
    markers.push({ marker, kind });
  }

  for (const pronoun of text.match(/\b(ele|ela|they|them|we|nos)\b/g) || []) {
    markers.push({ marker: pronoun, kind: "pronoun" });
  }

  return { markers: markers.slice(0, 24) };
}

