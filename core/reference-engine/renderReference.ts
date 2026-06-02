import type { BibliographicSource } from "./core/BibliographicSource";
import type { ReferenceRenderOutput } from "./core/ReferenceOutput";
import type { ReferenceStyle } from "./core/ReferenceStyle";
import { formatCitation } from "./formatCitation";
import { formatReference } from "./formatReference";
import { detectReferenceType } from "./detectors/detectReferenceType";
import { enrichReference } from "./enrichReference";
import { normalizeReference } from "./normalizers/normalizeReference";
import { resolveReferenceStyle } from "./styleResolver";
import { validateReference } from "./validators/validateReference";

export function renderReference(source: BibliographicSource, style?: ReferenceStyle): ReferenceRenderOutput {
  const resolvedStyle = resolveReferenceStyle(style || source.style);
  const normalized = normalizeReference({
    ...source,
    type: detectReferenceType(source),
  });
  const enriched = enrichReference(normalized);
  const validation = validateReference(enriched, resolvedStyle);
  const formattedReference = formatReference(enriched, resolvedStyle);
  const formattedCitation = formatCitation(enriched, {
    sourceId: enriched.id,
    style: resolvedStyle,
    mode: "parenthetical",
  }).citation;

  const usedFields = Object.entries(enriched)
    .filter(([, value]) => {
      if (value == null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.keys(value).length > 0;
      return true;
    })
    .map(([key]) => key);

  return {
    sourceId: enriched.id,
    style: resolvedStyle,
    type: enriched.type,
    formattedReference,
    formattedCitation,
    usedFields,
    missingFields: validation.missingRequiredFields,
    warnings: [...validation.warnings, ...validation.missingRecommendedFields.map((field) => `Campo recomendado ausente: ${field}`)],
    confidence: validation.confidence,
    richText: {
      plainText: formattedReference,
      markdown: formattedReference,
      html: `<p>${formattedReference}</p>`,
    },
  };
}

