/**
 * Responsabilidade do arquivo:
 * - Definir contratos do submodulo communicative-elaboration-and-co-construction.
 * - Padronizar entrada/saida para uso no generation layer e bridges.
 * - Garantir rastreabilidade de ideia nuclear, tensoes, hipoteses e refinamento.
 */
import type { GroundedEvidencePacket } from "../../07-knowledge-retrieval-and-research-layer/grounding/grounded-evidence-packet";

export interface IdeaSeed {
  coreClaim: string;
  userGoal: string;
  confidence: number;
  ambiguityNotes: string[];
}

export interface ConceptDecomposition {
  rootConcepts: string[];
  dependentConcepts: string[];
  implicitAssumptions: string[];
}

export interface DialogicalTension {
  id: string;
  poleA: string;
  poleB: string;
  productiveQuestion: string;
  intensity: number;
}

export interface HypothesisBranch {
  id: string;
  claim: string;
  epistemicHooks: string[];
  supportingHooks: string[];
}

export interface CoConstructionPlan {
  openingMove: string;
  reasoningMoves: string[];
  optionalClarifyingQuestion: string | null;
  closureMove: string;
}

export interface RefinementLoopResult {
  synthesizedDraft: string;
  refinementPrompts: string[];
  unresolvedPoints: string[];
}

export interface CommunicativeElaborationInput {
  message: string;
  activeContext: string[];
  constraints: string[];
  route: string;
  grounding: GroundedEvidencePacket | null;
}

export interface CommunicativeElaborationOutput {
  ideaSeed: IdeaSeed;
  decomposition: ConceptDecomposition;
  tensions: DialogicalTension[];
  hypothesisBranches: HypothesisBranch[];
  coConstructionPlan: CoConstructionPlan;
  refinement: RefinementLoopResult;
  confidence: number;
}

