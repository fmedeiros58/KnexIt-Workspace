"use client";

import type { KnexPdfPageBlueprint } from "../../core/KnexPdfBlueprintTypes";
import { PdfHtmlTextRenderer } from "./PdfHtmlTextRenderer";
import { PdfNonTextElementRenderer } from "./PdfNonTextElementRenderer";

export type KnexPdfBlueprintRendererProps = {
  blueprint: KnexPdfPageBlueprint;
  interactiveFormFields?: boolean;
  className?: string;
};

function countElements(blueprint: KnexPdfPageBlueprint, type: string): number {
  return blueprint.elements.filter(
    (element) =>
      ((element as { type?: string }).type ?? "text") === type ||
      (type === "text" && typeof (element as { text?: unknown }).text === "string"),
  ).length;
}

export function KnexPdfBlueprintRenderer({
  blueprint,
  interactiveFormFields = false,
  className,
}: KnexPdfBlueprintRendererProps) {
  return (
    <div
      className={["knex-pdf-blueprint-renderer", className]
        .filter(Boolean)
        .join(" ")}
      data-knexread-blueprint-renderer="true"
      data-knexread-blueprint-id={blueprint.blueprintId}
      data-knexread-blueprint-page-index={blueprint.pageIndex}
      data-knexread-blueprint-element-count={blueprint.elements.length}
      data-knexread-blueprint-text-count={countElements(blueprint, "text")}
      data-knexread-blueprint-image-count={countElements(blueprint, "image")}
      data-knexread-blueprint-shape-count={countElements(blueprint, "shape")}
      data-knexread-blueprint-form-field-count={countElements(
        blueprint,
        "form-field",
      )}
      data-knexread-blueprint-source-backend={blueprint.sourceBackend ?? ""}
      data-knexread-blueprint-extraction-mode={blueprint.extractionMode}
      data-knexread-blueprint-confidence={blueprint.confidence}
      style={{
        position: "absolute",
        inset: 0,
        width: `${blueprint.cssWidth}px`,
        height: `${blueprint.cssHeight}px`,
        pointerEvents: "auto",
        userSelect: "text",
      }}
    >
      <PdfNonTextElementRenderer
        elements={blueprint.elements}
        interactiveFormFields={interactiveFormFields}
      />
      <PdfHtmlTextRenderer elements={blueprint.elements} />
    </div>
  );
}
