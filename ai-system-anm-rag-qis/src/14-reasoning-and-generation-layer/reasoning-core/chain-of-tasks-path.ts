export function buildChainOfTasksPath(steps: string[]): string {
  return `Sequencia de tarefas: ${steps.join(" -> ")}`;
}
