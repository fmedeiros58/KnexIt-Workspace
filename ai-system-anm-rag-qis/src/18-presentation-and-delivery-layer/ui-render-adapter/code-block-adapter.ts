import { normalizeText } from "../presentation-contracts";
import type { CodeBlockView } from "../presentation-contracts";

export interface CodeBlockAdapterInput {
  text: string;
}

export interface CodeBlockAdapterOutput {
  ok: boolean;
  component: string;
  score: number;
  cleanedText: string;
  codeBlocks: CodeBlockView[];
}

export function codeBlockAdapter(input: CodeBlockAdapterInput): CodeBlockAdapterOutput {
  const text = normalizeText(input.text);
  const codeBlocks: CodeBlockView[] = [];

  const cleanedText = text.replace(/```([a-zA-Z0-9_+-]*)?\n([\s\S]*?)```/g, (_full, language, code) => {
    const normalizedCode = `${code || ""}`.replace(/\n+$/g, "");
    codeBlocks.push({
      language: `${language || "text"}`.trim().toLowerCase() || "text",
      code: normalizedCode,
      inline: false,
    });
    return "\n";
  }).trim();

  const hasCodeHints = /\b(function|class|const|let|var|return|if|for|while|SELECT|INSERT|UPDATE|DELETE)\b/.test(text);
  const score = codeBlocks.length > 0 ? 0.95 : hasCodeHints ? 0.72 : 0.54;

  return {
    ok: true,
    component: "code-block-adapter",
    score,
    cleanedText,
    codeBlocks,
  };
}
