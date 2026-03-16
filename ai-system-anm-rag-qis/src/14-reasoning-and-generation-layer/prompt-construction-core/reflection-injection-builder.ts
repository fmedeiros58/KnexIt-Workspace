import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildReflectionInjection(state: ProcessingState): string {
  const caveats = state.reflectiveNotes.caveats.slice(0, 4).join(" | ");
  const tensions = state.reflectiveNotes.tensions.slice(0, 3).join(" | ");
  return `Reflexao: caveats=${caveats || "nenhum"}; tensoes=${tensions || "nenhuma"}`;
}
