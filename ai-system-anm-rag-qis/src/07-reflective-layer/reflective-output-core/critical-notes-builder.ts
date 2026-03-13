export interface CriticalNotesBuilderInput {
  assumptions: string[];
  contradictions: string[];
  limitations: string[];
  tensions: string[];
  overclaims: string[];
}

export interface CriticalNotesBuilderOutput {
  notes: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function criticalNotesBuilder(input: CriticalNotesBuilderInput): CriticalNotesBuilderOutput {
  const notes = [
    ...input.assumptions,
    ...input.contradictions,
    ...input.limitations,
    ...input.tensions,
    ...input.overclaims,
  ].slice(0, 12);

  const score = Math.max(0.2, Math.min(1, notes.length / 12));

  return {
    notes,
    ok: true,
    component: "critical-notes-builder",
    score: Number(score.toFixed(4)),
    detail: `notes=${notes.length}`,
    context: {
      assumptions: input.assumptions.length,
      contradictions: input.contradictions.length,
      limitations: input.limitations.length,
      tensions: input.tensions.length,
      overclaims: input.overclaims.length,
    },
  };
}
