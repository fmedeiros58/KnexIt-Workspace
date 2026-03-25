export interface CompletionSufficiencyInput {
  structuredResponse: string;
  implicationsCount: number;
}

export interface CompletionSufficiencyResult {
  sufficient: boolean;
  notes: string[];
}

export function completionSufficiencyChecker(input: CompletionSufficiencyInput): CompletionSufficiencyResult {
  const text = `${input.structuredResponse || ""}`.trim();
  const notes: string[] = [];
  if (text.length < 32) notes.push("response_too_short");
  if (input.implicationsCount === 0) notes.push("inferential_signal_low");
  const sufficient = notes.length === 0;
  return { sufficient, notes };
}
