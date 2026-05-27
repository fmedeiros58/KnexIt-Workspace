import type { BibliographicSource } from "../core/BibliographicSource";
import type { ReferenceStyle } from "../core/ReferenceStyle";
import type { ValidationResult } from "../core/ValidationResult";
import { REQUIRED_FIELDS } from "./requiredFields";

function readPathValue(source: BibliographicSource, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value != null;
}

function resolveMissingRequired(source: BibliographicSource, style: ReferenceStyle): string[] {
  const styleRules = REQUIRED_FIELDS[style];
  const fields = styleRules[source.type] || styleRules.generic || [];

  return fields.filter((field) => {
    if (field.includes("|")) {
      const alternatives = field.split("|");
      return !alternatives.some((alt) => hasValue(readPathValue(source, alt)));
    }
    return !hasValue(readPathValue(source, field));
  });
}

export function validateReference(source: BibliographicSource, style: ReferenceStyle): ValidationResult {
  const missingRequiredFields = resolveMissingRequired(source, style);
  const warnings: string[] = [];
  const missingRecommendedFields: string[] = [];

  if (!source.doi && !source.url && (source.type === "journalArticle" || source.type === "webpage" || source.type === "website")) {
    missingRecommendedFields.push("doi|url");
    warnings.push("Fonte online sem DOI ou URL explícita.");
  }

  if (!source.pages && source.type === "journalArticle") {
    missingRecommendedFields.push("pages");
    warnings.push("Artigo sem paginação.");
  }

  const confidence: ValidationResult["confidence"] =
    missingRequiredFields.length === 0
      ? warnings.length === 0
        ? "high"
        : "medium"
      : missingRequiredFields.length <= 2
        ? "medium"
        : "low";

  return {
    canRender: Boolean(source.title?.trim()),
    missingRequiredFields,
    missingRecommendedFields,
    warnings,
    confidence,
  };
}

