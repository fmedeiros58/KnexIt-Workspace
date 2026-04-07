import type { PresentationRenderModel, SerializedPresentation } from "../presentation-contracts";
import { formatAbntReferenceList } from "../textual-layout-engine/abnt-reference-list-formatter";
import { applyHeadingAndListStrategy } from "../textual-layout-engine/heading-list-strategy";

export interface RichTextSerializerInput {
  model: PresentationRenderModel;
}

export interface RichTextSerializerOutput extends SerializedPresentation {
  format: "rich-text";
}

export function richTextSerializer(input: RichTextSerializerInput): RichTextSerializerOutput {
  const model = input.model;
  const prose = model.responseLayoutPlan
    ? applyHeadingAndListStrategy(model.bubble.text, model.responseLayoutPlan)
    : model.bubble.text;

  const abntMode = model.citationRequestContext.referenceListStyle === "abnt" &&
    model.citationRequestContext.requestedReferenceList;
  const referenceList = abntMode
    ? formatAbntReferenceList(model.referenceEntries, { markdown: true })
    : [];

  const payload = {
    kind: "rich-text",
    nodes: [
      {
        type: "paragraph",
        role: model.bubble.role,
        text: prose,
      },
      ...model.codeBlocks.map((block) => ({
        type: "code",
        language: block.language,
        text: block.code,
      })),
      ...model.citations.map((citation) => ({
        type: "citation",
        title: citation.title,
        url: citation.url,
        inlineCitation: citation.inlineCitation || null,
      })),
      ...(abntMode
        ? referenceList.map((reference) => ({
            type: "reference",
            style: "abnt",
            text: reference,
          }))
        : []),
    ],
    confidence: model.confidence,
    responseLayoutPlan: model.responseLayoutPlan,
    textualAudit: model.textualAudit,
    citationRequestContext: model.citationRequestContext,
  };

  return {
    format: "rich-text",
    text: JSON.stringify(payload),
    score: Math.max(0.56, Math.min(0.98, 0.74 + model.codeBlocks.length * 0.05)),
    rhetoricalShape: model.responseLayoutPlan?.rhetoricalShape,
    layoutNotes: model.responseLayoutPlan?.notes || [],
    textualAudit: model.textualAudit,
    payload,
  };
}
