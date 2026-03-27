import type { PresentationRenderModel, SerializedPresentation } from "../presentation-contracts";

export interface PlainTextSerializerInput {
  model: PresentationRenderModel;
  includeCitations?: boolean;
}

export interface PlainTextSerializerOutput extends SerializedPresentation {
  format: "plain-text";
}

export function plainTextSerializer(input: PlainTextSerializerInput): PlainTextSerializerOutput {
  const lines: string[] = [];
  const bubble = input.model.bubble;
  if (bubble.text) lines.push(bubble.text.trim());

  if (input.includeCitations !== false && input.model.citations.length > 0) {
    lines.push("", "Fontes:");
    for (const citation of input.model.citations.slice(0, 6)) {
      const title = citation.title || "fonte";
      lines.push(`- ${title}: ${citation.url}`);
    }
  }

  const text = lines.join("\n").trim();
  return {
    format: "plain-text",
    text,
    score: Math.max(0.5, Math.min(0.99, 0.72 + (input.model.citations.length ? 0.12 : 0))),
    payload: {
      text,
      citations: input.model.citations,
      confidence: input.model.confidence,
    },
  };
}
