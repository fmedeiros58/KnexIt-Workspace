export function synthesizeInferentialMap(input: {
  implications: string[];
  scenarios: string[];
  secondOrderEffects: string[];
}): { implications: string[]; scenarios: string[]; secondOrderEffects: string[] } {
  return {
    implications: input.implications.slice(0, 8),
    scenarios: input.scenarios.slice(0, 8),
    secondOrderEffects: input.secondOrderEffects.slice(0, 8),
  };
}
