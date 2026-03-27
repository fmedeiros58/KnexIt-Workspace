import type { PresentationRenderModel, SerializedPresentation } from "../presentation-contracts";

export interface MarkdownSerializerInput {
  model: PresentationRenderModel;
}

export interface MarkdownSerializerOutput extends SerializedPresentation {
  format: "markdown";
}

export function markdownSerializer(input: MarkdownSerializerInput): MarkdownSerializerOutput {
  const model = input.model;
  const sections: string[] = [];
  if (model.bubble.text) sections.push(model.bubble.text.trim());

  for (const block of model.codeBlocks) {
    sections.push("", `\`\`\`${block.language}`, block.code, "\`\`\`");
  }

  if (model.citations.length > 0) {
    sections.push("", "### Fontes");
    for (const citation of model.citations.slice(0, 8)) {
      sections.push(`- [${citation.title || "fonte"}](${citation.url})`);
    }
  }

  const text = sections.join("\n").trim();
  return {
    format: "markdown",
    text,
    score: Math.max(0.48, Math.min(0.98, 0.7 + (model.codeBlocks.length * 0.06))),
    payload: {
      markdown: text,
      citations: model.citations,
      codeBlocks: model.codeBlocks,
      confidence: model.confidence,
    },
  };
}
