export interface StepSequencerInput {
  resolvedSteps: string[];
  maxDepth: number;
}

export interface StepSequencerOutput {
  sequencedSteps: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function stepSequencer(input: StepSequencerInput): StepSequencerOutput {
  const maxSteps = Math.max(4, Math.min(24, input.maxDepth + 6));
  const sequencedSteps = input.resolvedSteps.slice(0, maxSteps);

  return {
    sequencedSteps,
    ok: true,
    component: "step-sequencer",
    score: Number(Math.min(1, sequencedSteps.length / maxSteps).toFixed(4)),
    detail: `sequenced=${sequencedSteps.length}`,
    context: {
      maxDepth: input.maxDepth,
      maxSteps,
    },
  };
}
