export type DominantPrinciple =
  | "economy"
  | "time"
  | "safety"
  | "accuracy"
  | "comfort"
  | "risk_reduction"
  | "effort_reduction"
  | "mixed"
  | "unknown";

export type FeasibleAction = {
  id: string;
  label: string;
  rationale: string;
  estimatedCost?: number;
  estimatedMarginalCost?: number;
  risks?: string[];
  satisfiesPrimaryGoal: boolean;
  satisfiesConstraints: boolean;
};

export type RejectedAction = {
  label: string;
  reason: string;
};

export type LogicalFrame = {
  primaryGoal: string | null;
  secondaryGoals: string[];
  dominantPrinciple: DominantPrinciple;
  constraints: string[];
  realWorldConditions: string[];
  relevantCosts: string[];
  irrelevantCosts: string[];
  feasibleActions: FeasibleAction[];
  rejectedActions: RejectedAction[];
  recommendedAction: string | null;
  recommendationReason: string | null;
  confidence: number;
  shouldAffectRouting: boolean;
  shouldAffectRetrieval: boolean;
  shouldTriggerOutputAudit: boolean;
};

export type LogicalAudit = {
  passed: boolean;
  issues: string[];
  repairedResponse?: string;
  score: number;
};

export type LogicalDiscernmentInput = {
  message: string;
  normalizedMessage: string;
  pragmaticIntent?: string;
  speechAct?: string;
  directiveForce?: number;
  tokenCount?: number;
  questionCount?: number;
  hasGreetingSignal?: boolean;
  recentTurns?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type DominantPrincipleDetection = {
  dominantPrinciple: DominantPrinciple;
  confidence: number;
  evidence: string[];
};

export type GoalExtraction = {
  primaryGoal: string | null;
  confidence: number;
  evidence: string[];
};

export type SecondaryGoalExtraction = {
  goals: string[];
  evidence: string[];
};

export type ConstraintMapping = {
  constraints: string[];
  evidence: string[];
};

export type RealWorldConditionExtraction = {
  conditions: string[];
  evidence: string[];
};

export type CandidateAction = {
  id: string;
  label: string;
  rationale: string;
  risks: string[];
  alignsWith: DominantPrinciple[];
};

export type MarginalCostEstimate = {
  estimatedCost?: number;
  estimatedMarginalCost?: number;
  relevantCosts: string[];
  irrelevantCosts: string[];
};

export type LogicalDiscernmentResult = {
  frame: LogicalFrame;
  score: number;
  flags: string[];
};

