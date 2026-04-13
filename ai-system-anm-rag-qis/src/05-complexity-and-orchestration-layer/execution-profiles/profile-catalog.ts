/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/profile-catalog
 * Responsibility: Publish the declarative execution profile catalog.
 * Primary Inputs: Individual profile declarations.
 * Primary Outputs: Catalog array, version and lookup map.
 * Upstream Dependencies: individual profile files
 * Downstream Dependencies: profile-selector, profile-composer, activation-policy
 * Invariants: The catalog is deterministic and versioned.
 * Failure Modes: Missing profile imports should fail at build time.
 * Audit Events: profile_catalog_loaded
 * Notes: Profiles remain declarative operating regimes over the same descending pipeline.
 */
import type { ExecutionProfile } from "../../bridges/contracts/execution-profile";
import { academicNormalizationProfile } from "./academic-normalization-profile";
import { architectureAuditProfile } from "./architecture-audit-profile";
import { constraintHeavyInstructionProfile } from "./constraint-heavy-instruction-profile";
import { conversationalDeepProfile } from "./conversational-deep-profile";
import { conversationalLightProfile } from "./conversational-light-profile";
import { debugCorrectionProfile } from "./debug-correction-profile";
import { decisionSupportProfile } from "./decision-support-profile";
import { greetingProfile } from "./greeting-profile";
import { highCautionValidationProfile } from "./high-caution-validation-profile";
import { memoryIntensiveProfile } from "./memory-intensive-profile";
import { multilingualAlignmentProfile } from "./multilingual-alignment-profile";
import { pedagogicalExplanationProfile } from "./pedagogical-explanation-profile";
import { reflectiveComparisonProfile } from "./reflective-comparison-profile";
import { researchExplorationProfile } from "./research-exploration-profile";
import { retrievalAugmentedProfile } from "./retrieval-augmented-profile";
import { summarySynthesisProfile } from "./summary-synthesis-profile";
import { teachingGuidanceProfile } from "./teaching-guidance-profile";
import { technicalAnalysisProfile } from "./technical-analysis-profile";
import { technicalImplementationProfile } from "./technical-implementation-profile";
import { writingCompositionProfile } from "./writing-composition-profile";

export const PROFILE_CATALOG_VERSION = "05.execution-profiles.v1";

export const executionProfileCatalog: ExecutionProfile[] = [
  greetingProfile,
  conversationalLightProfile,
  conversationalDeepProfile,
  pedagogicalExplanationProfile,
  teachingGuidanceProfile,
  technicalAnalysisProfile,
  technicalImplementationProfile,
  architectureAuditProfile,
  debugCorrectionProfile,
  researchExplorationProfile,
  retrievalAugmentedProfile,
  reflectiveComparisonProfile,
  decisionSupportProfile,
  academicNormalizationProfile,
  writingCompositionProfile,
  summarySynthesisProfile,
  constraintHeavyInstructionProfile,
  multilingualAlignmentProfile,
  highCautionValidationProfile,
  memoryIntensiveProfile,
];

export const executionProfileCatalogById = Object.fromEntries(
  executionProfileCatalog.map((profile) => [profile.id, profile]),
) as Record<string, ExecutionProfile>;
