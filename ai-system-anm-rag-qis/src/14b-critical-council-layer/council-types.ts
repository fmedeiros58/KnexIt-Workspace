/**
 * Layer: 14b-critical-council-layer
 * Module: council-types
 * Responsibility: Shared contracts for the critical council pass.
 */

import type { ProblemResolutionState } from "../14-reasoning-and-generation-layer/problem-resolution-core/problem-resolution-types";

export type CouncilRiskLevel = "low" | "medium" | "high" | "critical";

export type CouncilAction =
  | "approve"
  | "revise"
  | "regenerate"
  | "ask_clarification"
  | "send_with_caveat"
  | "block_delivery";

export type CouncilAdvisorId =
  | "logical"
  | "skeptical"
  | "evidence"
  | "completeness"
  | "anti_sycophancy"
  | "communication"
  | "user_interest"
  | "synthesis"
  | "scoring"
  | "revision_planner"
  | "final_delivery";

export type RevisionRecommendedAction =
  | "ignore"
  | "revise"
  | "regenerate"
  | "send_with_caveat"
  | "block";

export interface RetrievedSourceRef {
  title?: string;
  url?: string;
  snippet?: string;
  sourceId?: string;
  provider?: string;
  confidence?: number;
}

export interface CouncilInput {
  userInput: string;
  draftAnswer: string;

  reasoningState?: ProblemResolutionState | null;
  problemResolutionState?: ProblemResolutionState | null;
  problemResolutionArtifact?: unknown;

  retrievedEvidence?: string[];
  retrievedSources?: RetrievedSourceRef[];

  taskType?: string;
  userLanguage?: string;
  languageHint?: string;

  context?: unknown;
  reflectiveState?: unknown;
  inferentialState?: unknown;
  epistemicState?: unknown;
  metacognitiveState?: unknown;
  taskContract?: unknown;
}

export interface CouncilAdvisorReport {
  advisorId: CouncilAdvisorId;
  advisorName: string;

  passed: boolean;
  risk: CouncilRiskLevel;
  confidence: number;

  concerns: string[];
  strengths: string[];
  requiredRevisions: string[];
  optionalRevisions: string[];

  missingCounterpoints?: string[];
  unsupportedClaims?: string[];
  contradictions?: string[];
  overAgreementSignals?: string[];

  evidenceGaps?: string[];
  reasoningGaps?: string[];
  communicationGaps?: string[];
  userBenefitGaps?: string[];

  metadata?: Record<string, unknown>;
}

export interface CouncilScoreResult {
  score: number;
  level: CouncilRiskLevel;
  reasons: string[];

  /**
   * Optional aliases used by some scorers before they are normalized
   * into CouncilScoringState.
   */
  risk?: CouncilRiskLevel;
  notes?: string[];
}

export interface CouncilScoringState {
  sycophancy: CouncilScoreResult;
  evidence: CouncilScoreResult;
  contradiction: CouncilScoreResult;
  completeness: CouncilScoreResult;
  confidenceCalibration: CouncilScoreResult;
  criticalDepth: CouncilScoreResult;
  userBenefit: CouncilScoreResult;
  answerIntegrity: CouncilScoreResult;
}

export interface CouncilDisagreement {
  topic: string;
  advisorsInConflict: string[];
  positions: string[];
  chosenPosition: string;
  reason: string;
  priority: CouncilRiskLevel;
}

export interface DisagreementResolutionResult {
  disagreements: CouncilDisagreement[];
  dominantConcerns: string[];
  overriddenConcerns: string[];
  resolutionNotes: string[];
}

export interface RevisionPriority {
  issue: string;
  sourceAdvisor: string;
  severity: CouncilRiskLevel;
  priority: number;
  reason: string;
  recommendedAction: RevisionRecommendedAction;
}

export interface RevisionPriorityResult {
  priorities: RevisionPriority[];
  topIssues: RevisionPriority[];
  mustRevise: boolean;
  mustRegenerate: boolean;
  mustBlock: boolean;
}

export interface CouncilFinalRecommendation {
  action: CouncilAction;
  approved: boolean;
  confidence: number;

  reasons: string[];
  requiredRevisions: string[];
  optionalRevisions: string[];
  caveats: string[];

  deliveryBlocked: boolean;
  regenerationAllowed: boolean;

  /**
   * Optional diagnostic fields.
   */
  dominantRisk?: CouncilRiskLevel;
  deliveryNotes?: string[];
  blockingReasons?: string[];
}

export interface CouncilSynthesisResult {
  disagreementResolution: DisagreementResolutionResult;
  revisionPriority: RevisionPriorityResult;
  finalRecommendation: CouncilFinalRecommendation;
  synthesisSummary: string;

  /**
   * Optional aggregate mirrors. Some modules may choose to enrich synthesis
   * with these fields, while older modules can still ignore them.
   */
  mainConcerns?: string[];
  missingCounterpoints?: string[];
  unsupportedClaims?: string[];
  contradictions?: string[];
  overAgreementSignals?: string[];
  requiredRevisions?: string[];
  optionalRevisions?: string[];
}

export interface CouncilRevisionPlan {
  revisionRequired: boolean;
  regenerationRequired: boolean;

  revisionGoals: string[];
  rewriteInstructions: string[];
  constraintsToPreserve: string[];

  toneInstructions: string[];
  evidenceInstructions: string[];
  logicInstructions: string[];
  antiSycophancyInstructions: string[];
}

export interface WeakCritiqueGuardResult {
  passed: boolean;
  weakCritiqueSignals: string[];
  requiredSpecificity: string[];
}

export interface PrematureApprovalGuardResult {
  passed: boolean;
  blockedReasons: string[];
}

export interface UnsupportedConfidenceGuardResult {
  passed: boolean;
  overconfidenceSignals: string[];
  underconfidenceSignals: string[];
  requiredCalibration: string[];
}

export interface CouncilSecondPassResult {
  passed: boolean;
  remainingIssues: string[];
  resolvedIssues: string[];
  requiresAnotherPass: boolean;
  finalAction: CouncilAction;

  /**
   * Optional diagnostics for future expansion.
   */
  newIssues?: string[];
  blockingReasons?: string[];
}

export interface FinalDeliveryDecision {
  canDeliver: boolean;
  requiredAction: CouncilAction;
  reasons: string[];
}

export interface CouncilAssessmentBase {
  approved: boolean;
  action: CouncilAction;

  sycophancyRisk: CouncilRiskLevel;
  logicRisk: CouncilRiskLevel;
  evidenceRisk: CouncilRiskLevel;
  completenessRisk: CouncilRiskLevel;
  communicationRisk: CouncilRiskLevel;

  mainConcerns: string[];
  missingCounterpoints: string[];
  unsupportedClaims: string[];
  contradictions: string[];
  overAgreementSignals: string[];

  requiredRevisions: string[];
  optionalRevisions: string[];

  synthesisInstruction: string;
  advisorReports: CouncilAdvisorReport[];
}

export interface CouncilAssessment extends CouncilAssessmentBase {
  scoring: CouncilScoringState;
  synthesis: CouncilSynthesisResult;

  revisionPlan: CouncilRevisionPlan;
  rewriteInstruction: string;

  weakCritiqueGuard: WeakCritiqueGuardResult;
  prematureApprovalGuard: PrematureApprovalGuardResult;
  unsupportedConfidenceGuard: UnsupportedConfidenceGuardResult;

  secondPass?: CouncilSecondPassResult;

  deliveryDecision: FinalDeliveryDecision;
  finalRecommendation: CouncilFinalRecommendation;
}
