export type JudgmentMode =
  | "direct_objective_judgment"
  | "comparative_judgment"
  | "open_reflection"
  | "unknown";

export type ConstraintKind =
  | "exclude_price"
  | "exclude_cost"
  | "exclude_contextual_expansion"
  | "exclude_multiple_conditions"
  | "require_short_answer"
  | "require_absolute_evaluation"
  | "require_direct_opinion";

export type DominanceKind =
  | "strict_dominance"
  | "probable_dominance"
  | "no_clear_dominance";

export interface DirectJudgmentDetection {
  detected: boolean;
  mode: JudgmentMode;
  confidence: number;
  reasons: string[];
}

export interface ConstraintLockResult {
  locked: boolean;
  constraints: ConstraintKind[];
  reasons: string[];
}

export interface DominanceSignal {
  detected: boolean;
  kind: DominanceKind;
  winningOptionIndex?: number;
  confidence: number;
  reasons: string[];
}

export interface ObjectiveRationalityEvaluation {
  directJudgment: DirectJudgmentDetection;
  constraints: ConstraintLockResult;
  dominance: DominanceSignal;
  shouldSuppressHedging: boolean;
  shouldForceDirectAnswer: boolean;
  shouldAnswerWithConclusionFirst: boolean;
  recommendedAnswerStyle: "direct" | "direct_then_brief_reason" | "normal_reflective";
  summary: string[];
}

export interface OptionCandidate {
  index: number;
  rawText: string;
  normalizedText: string;
  numericSignals: number[];
  quantityScore: number;
  resourceBreadthScore: number;
}

export interface ObjectiveAnswerSelection {
  selected: boolean;
  selectedOptionIndex?: number;
  answer?: string;
  briefReason?: string;
  confidence: number;
  reasons: string[];
}

