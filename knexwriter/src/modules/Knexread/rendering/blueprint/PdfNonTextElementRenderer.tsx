"use client";

import type { KnexPdfBlueprintElement } from "../../core/KnexPdfBlueprintTypes";
import { KnexPdfBlueprintElementRenderer } from "./KnexPdfBlueprintElementRenderer";

export type PdfNonTextElementRendererProps = {
  elements: KnexPdfBlueprintElement[];
  interactiveFormFields?: boolean;
};

function isNonTextElement(element: KnexPdfBlueprintElement): boolean {
  const type = (element as { type?: string }).type;
  return type === "image" || type === "shape" || type === "form-field";
}

export function getBlueprintNonTextElements(
  elements: KnexPdfBlueprintElement[],
): KnexPdfBlueprintElement[] {
  return elements.filter(isNonTextElement);
}

export function PdfNonTextElementRenderer({
  elements,
  interactiveFormFields = false,
}: PdfNonTextElementRendererProps) {
  const nonTextElements = getBlueprintNonTextElements(elements);

  return (
    <div
      className="knex-pdf-blueprint-non-text-renderer"
      data-knexread-blueprint-non-text-renderer="true"
      data-knexread-blueprint-non-text-count={nonTextElements.length}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: interactiveFormFields ? "auto" : "none",
      }}
    >
      {nonTextElements.map((element) => (
        <KnexPdfBlueprintElementRenderer
          key={(element as { id: string }).id}
          element={element}
          interactiveFormFields={interactiveFormFields}
        />
      ))}
    </div>
  );
}
