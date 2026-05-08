/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/profile-helpers
 * Responsibility: Provide a canonical base shape for declarative execution profiles.
 * Primary Inputs: Partial execution profile declarations.
 * Primary Outputs: Fully shaped ExecutionProfile objects.
 * Upstream Dependencies: bridges/contracts/execution-profile, bridges/contracts/layer-mode
 * Downstream Dependencies: individual profile files, profile catalog
 * Invariants: Every profile keeps the descending pipeline backbone active.
 * Failure Modes: Missing fields are defaulted conservatively.
 * Audit Events: execution_profile_defined
 * Notes: The helper prevents drift across the profile catalog.
 */
import type { PipelineLayerId } from "../../shared/enums/pipeline-enums";
import type { ExecutionProfile } from "../../bridges/contracts/execution-profile";
import type { LayerMode } from "../../bridges/contracts/layer-mode";

const BASE_LAYER_INTENSITIES: Partial<Record<PipelineLayerId, LayerMode>> = {
  input: "required",
  language: "required",
  conversation: "light",
  context: "medium",
  orchestration: "required",
  "deliberative-task-contract": "light",
  memory: "light",
  "response-planning": "medium",
  knowledge: "light",
  quantum: "light",
  preparatory: "light",
  reflective: "light",
  inferential: "medium",
  metacognitive: "light",
  "epistemic-integration": "light",
  generation: "required",
  "critical-council": "medium",
  structure: "required",
  "academic-normalization": "light",
  validation: "required",
  "response-behavior": "medium",
  "proactivity-gate": "light",
  "delivery-profile": "light",
  "linguistic-humanizer": "light",
  "response-calibration": "medium",
  presentation: "required",
  observability: "required",
  feedback: "light",
};

export function defineExecutionProfile(profile: ExecutionProfile): ExecutionProfile {
  return {
    ...profile,
    layerIntensities: {
      ...BASE_LAYER_INTENSITIES,
      ...profile.layerIntensities,
    },
    specialConstraints: [...profile.specialConstraints],
    tags: [...profile.tags],
  };
}
