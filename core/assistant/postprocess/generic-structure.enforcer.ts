import type { TemplateSectionSpec, TemplateSpec } from "@/core/assistant/templates/template-spec";

const SECTION_SIMILARITY_THRESHOLD = 0.84;
const NOT_INFORMED_PT = "Nao informado no trecho.";
const NOT_INFORMED_EN = "Not informed in the excerpt.";

export type StructureQualityMetrics = {
  coverageScore: number;
  redundantPairs: number;
  headingsCount: number;
  requiredPresent: number;
  requiredTotal: number;
  missingRequiredSections: string[];
  needsRepair: boolean;
};

export type StructureEnforcementResult = {
  renderedText: string;
  repairPrompt: string;
  metrics: StructureQualityMetrics;
};

type SectionContent = {
  title: string;
  required: boolean;
  content: string;
  missing: boolean;
};

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeLine(value: string) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function splitParagraphs(text: string) {
  return `${text || ""}`
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((row) => row.trim())
    .filter(Boolean);
}

function tokenize(text: string) {
  return normalize(text)
    .split(/\s+/g)
    .filter((token) => token.length >= 3);
}

function shingles(text: string, size = 3) {
  const tokens = tokenize(text);
  if (tokens.length <= size) return new Set(tokens);
  const values = new Set<string>();
  for (let idx = 0; idx <= tokens.length - size; idx += 1) {
    values.add(tokens.slice(idx, idx + size).join(" "));
  }
  return values;
}

function jaccard(a: string, b: string) {
  const left = shingles(a);
  const right = shingles(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = new Set([...left, ...right]).size;
  return intersection / Math.max(1, union);
}

function headingToCanonical(line: string, aliases: Map<string, string>) {
  const noHash = line.replace(/^#{1,6}\s*/, "");
  const noNumber = noHash.replace(/^\d+(\.\d+)*\s*[-–—:]?\s*/, "");
  const clean = noNumber.replace(/[:：]\s*$/, "").trim();
  if (!clean || clean.length > 160) return null;
  const normalized = normalize(clean);
  if (!normalized) return null;
  return aliases.get(normalized) || null;
}

function placeholderByLanguage(langTag: string) {
  const normalized = `${langTag || ""}`.trim().toLowerCase();
  if (normalized.startsWith("en")) return NOT_INFORMED_EN;
  return NOT_INFORMED_PT;
}

function isPlaceholder(value: string, placeholder: string) {
  const normalizedValue = normalize(value);
  const normalizedPlaceholder = normalize(placeholder);
  return normalizedValue === normalizedPlaceholder;
}

function limitTextLength(value: string, maxChars: number) {
  const trimmed = `${value || ""}`.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(120, maxChars - 3)).trimEnd()}...`;
}

function uniqueParagraphs(paragraphs: string[]) {
  const seen = new Set<string>();
  const filtered: string[] = [];
  for (const paragraph of paragraphs) {
    const key = normalize(paragraph).slice(0, 240);
    if (key.length > 48 && seen.has(key)) continue;
    if (key.length > 48) seen.add(key);
    filtered.push(paragraph);
  }
  return filtered;
}

function toRepairPrompt(input: {
  templateSpec: TemplateSpec;
  metrics: StructureQualityMetrics;
  placeholder: string;
  langTag: string;
}) {
  const { templateSpec, metrics, placeholder, langTag } = input;
  const isEnglish = `${langTag || ""}`.toLowerCase().startsWith("en");
  const sectionLines = templateSpec.sections
    .map((section, idx) => {
      const flags = [
        section.required ? (isEnglish ? "required" : "obrigatoria") : isEnglish ? "optional" : "opcional",
        `${isEnglish ? "max_paragraphs" : "max_paragrafos"}=${section.maxParagraphs}`,
        `${isEnglish ? "max_chars" : "max_chars"}=${section.maxChars}`,
      ];
      return `${idx + 1}. ${section.title} [${flags.join("; ")}]`;
    })
    .join("\n");

  if (isEnglish) {
    return [
      "REPAIR INSTRUCTION:",
      `Rewrite the text in the academic template "${templateSpec.title}".`,
      `Language: ${langTag}.`,
      "Do not invent any missing information.",
      `If required information is absent, write exactly: "${placeholder}".`,
      "Use the exact section titles listed below and avoid redundant sections.",
      "",
      "SECTIONS:",
      sectionLines,
      "",
      `CURRENT COVERAGE SCORE: ${metrics.coverageScore.toFixed(2)}`,
      `CURRENT REDUNDANT PAIRS: ${metrics.redundantPairs}`,
      `MISSING REQUIRED SECTIONS: ${metrics.missingRequiredSections.join(", ") || "(none)"}`,
    ].join("\n");
  }

  return [
    "INSTRUCAO DE REPARO:",
    `Reescreva o texto no template academico "${templateSpec.title}".`,
    `Idioma: ${langTag}.`,
    "Nao invente informacoes ausentes.",
    `Se faltar informacao obrigatoria, escreva exatamente: "${placeholder}".`,
    "Use exatamente os titulos de secao listados abaixo e remova redundancias entre secoes.",
    "",
    "SECOES:",
    sectionLines,
    "",
    `COBERTURA ATUAL: ${metrics.coverageScore.toFixed(2)}`,
    `PARES REDUNDANTES ATUAIS: ${metrics.redundantPairs}`,
    `SECOES OBRIGATORIAS AUSENTES: ${metrics.missingRequiredSections.join(", ") || "(nenhuma)"}`,
  ].join("\n");
}

export class GenericStructureEnforcer {
  private parseSectionsByHeading(text: string, templateSpec: TemplateSpec) {
    const aliasMap = new Map<string, string>();
    for (const section of templateSpec.sections) {
      aliasMap.set(normalize(section.title), section.title);
    }
    for (const [alias, canonical] of Object.entries(templateSpec.aliases || {})) {
      aliasMap.set(normalize(alias), canonical);
    }

    const lines = `${text || ""}`.replace(/\r\n/g, "\n").split("\n");
    const mapped = new Map<string, string[]>();
    let currentSection: string | null = null;
    let matchedAnyHeading = false;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (currentSection) {
          const bucket = mapped.get(currentSection) || [];
          bucket.push("");
          mapped.set(currentSection, bucket);
        }
        continue;
      }

      const canonical = headingToCanonical(line, aliasMap);
      if (canonical) {
        currentSection = canonical;
        matchedAnyHeading = true;
        if (!mapped.has(canonical)) mapped.set(canonical, []);
        continue;
      }

      if (!currentSection) {
        currentSection = templateSpec.sections[0]?.title || "Conteudo";
        if (!mapped.has(currentSection)) mapped.set(currentSection, []);
      }
      const bucket = mapped.get(currentSection) || [];
      bucket.push(line);
      mapped.set(currentSection, bucket);
    }

    if (!matchedAnyHeading) {
      const fallbackSection = templateSpec.sections[0]?.title || "Conteudo";
      mapped.set(fallbackSection, [text.trim()]);
    }

    return mapped;
  }

  private sanitizeSectionContent(raw: string, sectionSpec: TemplateSectionSpec) {
    const paragraphs = splitParagraphs(raw);
    const deduped = uniqueParagraphs(paragraphs);
    const limitedParagraphs = deduped.slice(0, Math.max(1, sectionSpec.maxParagraphs));
    const normalizedParagraphs = limitedParagraphs.map((paragraph) => {
      if (sectionSpec.allowBullets) return paragraph;
      return paragraph
        .split("\n")
        .map((line) => line.replace(/^[-*]\s+/, ""))
        .map((line) => sanitizeLine(line))
        .filter(Boolean)
        .join(" ");
    });
    return limitTextLength(normalizedParagraphs.join("\n\n"), sectionSpec.maxChars);
  }

  private computeRedundantPairs(sections: SectionContent[], placeholder: string) {
    let redundantPairs = 0;
    for (let idx = 0; idx < sections.length; idx += 1) {
      const current = sections[idx];
      if (!current || isPlaceholder(current.content, placeholder)) continue;
      for (let jdx = idx + 1; jdx < sections.length; jdx += 1) {
        const candidate = sections[jdx];
        if (!candidate || isPlaceholder(candidate.content, placeholder)) continue;
        const similarity = jaccard(current.content, candidate.content);
        if (similarity >= SECTION_SIMILARITY_THRESHOLD) {
          redundantPairs += 1;
        }
      }
    }
    return redundantPairs;
  }

  private dedupeAcrossSections(sections: SectionContent[], placeholder: string) {
    const seenParagraphs = new Set<string>();
    return sections.map((section) => {
      if (isPlaceholder(section.content, placeholder)) return section;
      const paragraphs = splitParagraphs(section.content);
      const kept: string[] = [];
      for (const paragraph of paragraphs) {
        const key = normalize(paragraph).slice(0, 260);
        if (key.length > 48 && seenParagraphs.has(key)) continue;
        if (key.length > 48) seenParagraphs.add(key);
        kept.push(paragraph);
      }
      if (!kept.length) {
        return { ...section, content: placeholder, missing: true };
      }
      return { ...section, content: kept.join("\n\n"), missing: false };
    });
  }

  enforce(text: string, templateSpec: TemplateSpec, langTag = templateSpec.langTag): StructureEnforcementResult {
    const placeholder = placeholderByLanguage(langTag);
    const parsed = this.parseSectionsByHeading(text, templateSpec);
    const canonicalSections: SectionContent[] = templateSpec.sections.map((sectionSpec) => {
      const joined = (parsed.get(sectionSpec.title) || []).join("\n").trim();
      const sanitized = this.sanitizeSectionContent(joined, sectionSpec);
      if (!sanitized) {
        return {
          title: sectionSpec.title,
          required: sectionSpec.required,
          content: placeholder,
          missing: true,
        };
      }
      return {
        title: sectionSpec.title,
        required: sectionSpec.required,
        content: sanitized,
        missing: false,
      };
    });

    const redundantPairsBefore = this.computeRedundantPairs(canonicalSections, placeholder);
    const dedupedSections = templateSpec.rules.dedupeAcrossSections
      ? this.dedupeAcrossSections(canonicalSections, placeholder)
      : canonicalSections;

    const missingRequiredSections = dedupedSections
      .filter((section) => section.required)
      .filter((section) => section.missing || isPlaceholder(section.content, placeholder))
      .map((section) => section.title);
    const requiredTotal = dedupedSections.filter((section) => section.required).length;
    const requiredPresent = Math.max(0, requiredTotal - missingRequiredSections.length);
    const coverageScore = requiredTotal <= 0 ? 1 : requiredPresent / requiredTotal;
    const headingsCount = dedupedSections.filter((section) => !isPlaceholder(section.content, placeholder)).length;
    const redundancyPairThreshold = Math.max(1, Math.round(templateSpec.rules.redundancyThreshold));
    const needsRepair =
      coverageScore < templateSpec.rules.minCoverage ||
      redundantPairsBefore >= redundancyPairThreshold ||
      headingsCount < templateSpec.rules.minHeadingsCount;

    const renderedText = dedupedSections
      .map((section) => {
        return `## ${section.title}\n${section.content || placeholder}`;
      })
      .join("\n\n")
      .trim();

    const metrics: StructureQualityMetrics = {
      coverageScore,
      redundantPairs: redundantPairsBefore,
      headingsCount,
      requiredPresent,
      requiredTotal,
      missingRequiredSections,
      needsRepair,
    };

    return {
      renderedText,
      repairPrompt: toRepairPrompt({
        templateSpec,
        metrics,
        placeholder,
        langTag,
      }),
      metrics,
    };
  }
}
