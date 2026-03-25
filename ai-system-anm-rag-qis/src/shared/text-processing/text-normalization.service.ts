/**
 * Responsabilidade do arquivo:
 * - Centralizar normalizacao textual canonica por perfil de uso do pipeline.
 * - Gerar fingerprint estavel para cache e dedupe.
 * - Gerar variantes controladas ("familias") sob demanda por etapa.
 */
export type CanonicalProfile = "cache" | "intent" | "retrieval" | "dedupe";
export type VariantMode = "intent" | "retrieval";

export interface VariantOptions {
  maxVariants?: number;
  maxInputLength?: number;
  allowDiacriticsVariant?: boolean;
  allowLowercaseVariant?: boolean;
  allowMorphVariant?: boolean;
}

class TextNormalizationService {
  private readonly spaceRe = /\s+/g;

  canonical(text: string, profile: CanonicalProfile): string {
    const source = `${text ?? ""}`;
    const stripped = this.stripControlChars(source);

    if (profile === "retrieval") {
      return this.normalizeSpaces(stripped).trim();
    }

    return this.normalizeSpaces(this.toLower(stripped)).trim();
  }

  fingerprint(text: string): string {
    const lowered = this.toLower(this.stripControlChars(`${text ?? ""}`));
    const withoutDiacritics = this.removeDiacritics(lowered);
    const normalized = this.normalizeSpaces(withoutDiacritics);
    return normalized
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(this.spaceRe, " ")
      .trim();
  }

  variants(text: string, mode: VariantMode, opts?: VariantOptions): string[] {
    const options: Required<VariantOptions> = {
      maxVariants: opts?.maxVariants ?? 4,
      maxInputLength: opts?.maxInputLength ?? 280,
      allowDiacriticsVariant: opts?.allowDiacriticsVariant ?? true,
      allowLowercaseVariant: opts?.allowLowercaseVariant ?? true,
      allowMorphVariant: opts?.allowMorphVariant ?? true,
    };

    const raw = `${text ?? ""}`.trim();
    if (!raw) return [];

    if (mode === "retrieval" && raw.length > options.maxInputLength) {
      return [raw];
    }

    const output: string[] = [];
    const seenFingerprints = new Set<string>();
    const pushDedup = (candidate: string) => {
      if (!candidate) return;
      const normalizedCandidate = `${candidate}`.trim();
      if (!normalizedCandidate) return;
      const fp = this.fingerprint(normalizedCandidate);
      if (!fp || seenFingerprints.has(fp)) return;
      seenFingerprints.add(fp);
      output.push(normalizedCandidate);
    };

    pushDedup(raw);

    if (options.allowDiacriticsVariant) {
      pushDedup(this.removeDiacritics(raw));
    }

    if (options.allowLowercaseVariant) {
      pushDedup(this.toLower(raw));
    }

    if (mode === "retrieval") {
      pushDedup(this.canonical(raw, "retrieval"));
    }

    if (mode === "intent") {
      pushDedup(this.canonical(raw, "intent"));
    }

    if (mode === "intent" && options.allowMorphVariant) {
      for (const variant of this.intentMorphVariants(raw)) {
        pushDedup(variant);
      }
    }

    return output.slice(0, options.maxVariants);
  }

  private intentMorphVariants(raw: string): string[] {
    const base = this.normalizeSpaces(this.removeDiacritics(this.toLower(raw)));
    const wordCount = base.split(" ").filter(Boolean).length;
    if (wordCount > 10) return [];

    const variants = new Set<string>();
    const families: Array<{ detect: RegExp; replace: RegExp; outputs: string[] }> = [
      {
        detect: /\b(faca|faz|fazer)\b/i,
        replace: /\b(faca|faz|fazer)\b/g,
        outputs: ["faca", "faz", "fazer", "fa\u00e7a"],
      },
      {
        detect: /\b(acao|acoes)\b/i,
        replace: /\b(acao|acoes)\b/g,
        outputs: ["acao", "acoes", "a\u00e7\u00e3o", "a\u00e7\u00f5es"],
      },
    ];

    for (const family of families) {
      if (!family.detect.test(base)) continue;
      for (const output of family.outputs) {
        variants.add(base.replace(family.replace, output));
      }
    }

    return [...variants];
  }

  private stripControlChars(value: string): string {
    return value.replace(/[\u0000-\u001F\u007F]/g, " ");
  }

  private normalizeSpaces(value: string): string {
    return value.replace(this.spaceRe, " ");
  }

  private toLower(value: string): string {
    return value.toLocaleLowerCase("pt-BR");
  }

  private removeDiacritics(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
}

export const textNormalizationService = new TextNormalizationService();

