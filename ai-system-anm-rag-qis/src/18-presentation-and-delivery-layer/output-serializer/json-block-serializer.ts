import type { PresentationRenderModel, SerializedPresentation } from "../presentation-contracts";

export interface JsonBlockSerializerInput {
  model: PresentationRenderModel;
}

export interface JsonBlockSerializerOutput extends SerializedPresentation {
  format: "json-block";
}

export function jsonBlockSerializer(input: JsonBlockSerializerInput): JsonBlockSerializerOutput {
  const model = input.model;
  const payload = {
    kind: "presentation-json-block",
    channel: model.channel,
    format: model.format,
    bubble: model.bubble,
    codeBlocks: model.codeBlocks,
    citations: model.citations,
    documents: model.documents,
    media: model.media,
    confidence: model.confidence,
  };

  const text = JSON.stringify(payload, null, 2);

  return {
    format: "json-block",
    text,
    score: 0.92,
    payload,
  };
}
