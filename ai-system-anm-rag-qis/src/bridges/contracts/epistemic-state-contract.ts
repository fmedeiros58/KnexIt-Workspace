import type { EpistemicStatus } from "../../shared/enums/epistemic-status-enums";

export interface EpistemicStateContract {
  status: EpistemicStatus;
  uncertainty: number;
  caveats: string[];
  contradictions: string[];
}
