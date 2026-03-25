export interface DependencyResolverInput {
  steps: string[];
}

export interface DependencyResolverOutput {
  resolvedSteps: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

const DEPENDENCY_MAP: Record<string, string[]> = {
  "truth_collapse": ["hypothesis_interference"],
  "hypothesis_interference": ["quantum_superposition"],
  "merge_evidence": ["retrieve_knowledge"],
  "retrieve_knowledge": ["retrieve_memory"],
};

export function dependencyResolver(input: DependencyResolverInput): DependencyResolverOutput {
  const resolved: string[] = [];

  function addStep(step: string) {
    for (const dependency of DEPENDENCY_MAP[step] || []) addStep(dependency);
    if (!resolved.includes(step)) resolved.push(step);
  }

  for (const step of input.steps) addStep(step);

  return {
    resolvedSteps: resolved,
    ok: true,
    component: "dependency-resolver",
    score: Number(Math.min(1, resolved.length / 16).toFixed(4)),
    detail: `resolved=${resolved.length}`,
    context: {},
  };
}
