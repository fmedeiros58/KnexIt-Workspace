import type { PresentationRenderModel, SerializedPresentation } from "../presentation-contracts";

export interface RichTextSerializerInput {
  model: PresentationRenderModel;
}

export interface RichTextSerializerOutput extends SerializedPresentation {
  format: "rich-text";
}

export function richTextSerializer(input: RichTextSerializerInput): RichTextSerializerOutput {
  const model = input.model;
  const payload = {
    kind: "rich-text",
    nodes: [
      {
        type: "paragraph",
        role: model.bubble.role,
        text: model.bubble.text,
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
      })),
    ],
    confidence: model.confidence,
  };

  return {
    format: "rich-text",
    text: JSON.stringify(payload),
    score: Math.max(0.56, Math.min(0.98, 0.74 + model.codeBlocks.length * 0.05)),
    payload,
  };
}
