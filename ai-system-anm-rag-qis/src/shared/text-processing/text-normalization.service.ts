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

type AbbreviationRule = {
  pattern: RegExp;
  replacement: string;
};

const CANONICAL_ABBREVIATION_RULES: AbbreviationRule[] = [
  { pattern: /\b(?:vc|vce|vcs|c[eê]|oces)\b/gi, replacement: "voce" },
  { pattern: /\b(?:t{2,}e|teeh|teh)\b/gi, replacement: "te" },
  { pattern: /\b(?:pq|pk|prq|pqe|pke|porq|porqe)\b/gi, replacement: "porque" },
  { pattern: /\b(?:tbm|tb|tmb|tbn)\b/gi, replacement: "tambem" },
  { pattern: /\b(?:qndo|qdo|qnd)\b/gi, replacement: "quando" },
  { pattern: /\b(?:nd|nadaa)\b/gi, replacement: "nada" },
  { pattern: /\b(?:blz)\b/gi, replacement: "beleza" },
  { pattern: /\b(?:obg|obgd|obgdo|obgda|obrigd)\b/gi, replacement: "obrigado" },
  { pattern: /\b(?:vlw|vlww|vllw)\b/gi, replacement: "valeu" },
  { pattern: /\b(?:flw|falow|faloo)\b/gi, replacement: "falou" },
  { pattern: /\b(?:hj|oje)\b/gi, replacement: "hoje" },
  { pattern: /\b(?:agr|agorinha)\b/gi, replacement: "agora" },
  { pattern: /\b(?:dps|depoiss|dpz)\b/gi, replacement: "depois" },
  { pattern: /\b(?:amanh|amanhaa)\b/gi, replacement: "amanha" },
  { pattern: /\b(?:msg|mensg)\b/gi, replacement: "mensagem" },
  { pattern: /\b(?:vdd|vrdd)\b/gi, replacement: "verdade" },
  { pattern: /\b(?:ctz|certezaa)\b/gi, replacement: "certeza" },
  { pattern: /\b(?:mt|mto|muitoo)\b/gi, replacement: "muito" },
  { pattern: /\b(?:mts)\b/gi, replacement: "muitos" },
  { pattern: /\b(?:tt|tot)\b/gi, replacement: "tudo" },
  { pattern: /\b(?:td)\b/gi, replacement: "tudo" },
  { pattern: /\b(?:tbm\s+bem|td\s+bem)\b/gi, replacement: "tudo bem" },
  { pattern: /\b(?:ta|tah|taa)\b/gi, replacement: "esta" },
  { pattern: /\b(?:to|toh|too)\b/gi, replacement: "estou" },
  { pattern: /\b(?:tava|tavam)\b/gi, replacement: "estava" },
  { pattern: /\b(?:pra|pr[aá])\b/gi, replacement: "para" },
  { pattern: /\b(?:pro)\b/gi, replacement: "para o" },
  { pattern: /\b(?:pra\s+gnt|pra\s+gente)\b/gi, replacement: "para a gente" },
  { pattern: /(^|\s)p\/(?=\s|$)/gi, replacement: "$1para " },
  { pattern: /(^|\s)c\/(?=\s|$)/gi, replacement: "$1com " },
  { pattern: /(^|\s)s\/(?=\s|$)/gi, replacement: "$1sem " },
  { pattern: /\b(?:cmg)\b/gi, replacement: "comigo" },
  { pattern: /\b(?:ctg)\b/gi, replacement: "contigo" },
  { pattern: /\b(?:cm)\b/gi, replacement: "com" },
  { pattern: /\b(?:smp)\b/gi, replacement: "sempre" },
  { pattern: /\b(?:nuncaa)\b/gi, replacement: "nunca" },
  { pattern: /\b(?:qria|qro|kero|queroo)\b/gi, replacement: "quero" },
  { pattern: /\b(?:qria|qriah)\b/gi, replacement: "queria" },
  { pattern: /\b(?:qria\s+saber)\b/gi, replacement: "queria saber" },
  { pattern: /\b(?:qs|q\s+seja)\b/gi, replacement: "que seja" },
  { pattern: /\b(?:ql|qal)\b/gi, replacement: "qual" },
  { pattern: /\b(?:qlqr|qqr|qquer)\b/gi, replacement: "qualquer" },
  { pattern: /\b(?:qnts|qts)\b/gi, replacement: "quantos" },
  { pattern: /\b(?:qnt|qt)\b/gi, replacement: "quanto" },
  { pattern: /\b(?:qnto)\b/gi, replacement: "quanto" },
  { pattern: /\b(?:qntas)\b/gi, replacement: "quantas" },
  { pattern: /\b(?:qnta)\b/gi, replacement: "quanta" },
  { pattern: /\b(?:pf|pfv|pls|plz)\b/gi, replacement: "por favor" },
  { pattern: /\b(?:att)\b/gi, replacement: "atenciosamente" },
  { pattern: /\b(?:abs)\b/gi, replacement: "abracos" },
  { pattern: /\b(?:bj|bjs|beijoss)\b/gi, replacement: "beijos" },
  { pattern: /\b(?:fds)\b/gi, replacement: "fim de semana" },
  { pattern: /\b(?:sla|sei laa)\b/gi, replacement: "sei la" },
  { pattern: /\b(?:nsei|naosei|n\s+sei)\b/gi, replacement: "nao sei" },
  { pattern: /\b(?:naum|naoo|nãum|num)\b/gi, replacement: "nao" },
  { pattern: /\b(?:simm)\b/gi, replacement: "sim" },
  { pattern: /\b(?:mn|mano|mnh)\b/gi, replacement: "mano" },
  { pattern: /\b(?:gnt|gent|galera)\b/gi, replacement: "gente" },
  { pattern: /\b(?:kd|cadeh)\b/gi, replacement: "cade" },
  { pattern: /\b(?:aki|aqi)\b/gi, replacement: "aqui" },
  { pattern: /\b(?:alii)\b/gi, replacement: "ali" },
  { pattern: /\b(?:aki|aq)\b/gi, replacement: "aqui" },
  { pattern: /\b(?:vlr)\b/gi, replacement: "valor" },
  { pattern: /\b(?:info|infos)\b/gi, replacement: "informacao" },
  { pattern: /\b(?:doc|docs)\b/gi, replacement: "documento" },
  { pattern: /\b(?:img|imgs)\b/gi, replacement: "imagem" },
  { pattern: /\b(?:resp)\b/gi, replacement: "resposta" },
  { pattern: /\b(?:duv|duvida)\b/gi, replacement: "duvida" },
  { pattern: /\b(?:obs)\b/gi, replacement: "observacao" },
  { pattern: /\b(?:req)\b/gi, replacement: "requisicao" },
  { pattern: /\b(?:cfg)\b/gi, replacement: "configuracao" },
  { pattern: /\b(?:env)\b/gi, replacement: "ambiente" },
  { pattern: /\b(?:aprox)\b/gi, replacement: "aproximadamente" },
  { pattern: /\b(?:mins)\b/gi, replacement: "minutos" },
  { pattern: /\b(?:min)\b/gi, replacement: "minuto" },
  { pattern: /\b(?:hrs)\b/gi, replacement: "horas" },
  { pattern: /\b(?:hr)\b/gi, replacement: "hora" },
  { pattern: /\b(?:seg)\b/gi, replacement: "segundo" },
  { pattern: /\b(?:segs)\b/gi, replacement: "segundos" },
  { pattern: /\b(?:msgs)\b/gi, replacement: "mensagens" },
  { pattern: /\b(?:vamo|vam)\b/gi, replacement: "vamos" },
  { pattern: /\b(?:boraa|borah)\b/gi, replacement: "bora" },
  { pattern: /\b(?:falr|falarr)\b/gi, replacement: "falar" },
  { pattern: /\b(?:explicae|explicae)\b/gi, replacement: "explica ai" },
];

class TextNormalizationService {
  private readonly spaceRe = /\s+/g;

  expandContractions(text: string): string {
    const lowered = this.toLower(this.stripControlChars(`${text ?? ""}`));
    const withoutDiacritics = this.removeDiacritics(lowered);
    return this.expandCommonAbbreviations(withoutDiacritics);
  }

  canonical(text: string, profile: CanonicalProfile): string {
    const source = `${text ?? ""}`;
    const stripped = this.stripControlChars(source);
    const expanded = this.expandContractions(stripped);

    if (profile === "retrieval") {
      return this.normalizeSpaces(stripped).trim();
    }

    return this.normalizeSpaces(expanded).trim();
  }

  fingerprint(text: string): string {
    const normalized = this.normalizeSpaces(this.expandContractions(`${text ?? ""}`));
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

  private expandCommonAbbreviations(value: string): string {
    let expanded = this.normalizeSpaces(`${value ?? ""}`);
    for (const rule of CANONICAL_ABBREVIATION_RULES) {
      expanded = expanded.replace(rule.pattern, rule.replacement);
    }
    return this.normalizeSpaces(expanded).trim();
  }

  private removeDiacritics(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
}

export const textNormalizationService = new TextNormalizationService();
