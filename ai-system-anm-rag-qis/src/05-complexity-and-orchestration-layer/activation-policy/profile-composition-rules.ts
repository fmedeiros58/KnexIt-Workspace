/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: activation-policy/profile-composition-rules
 * Responsibility: Resolve policy strings from composed execution profiles.
 * Primary Inputs: Execution profiles ordered by priority and weight.
 * Primary Outputs: Consolidated policy names for the adaptive contract.
 * Upstream Dependencies: bridges/contracts/execution-profile
 * Downstream Dependencies: layer-activation-matrix, adaptive contract builder
 * Invariants: Higher priority profiles override lighter policies when necessary.
 * Failure Modes: Empty input degrades to conservative defaults.
 * Audit Events: profile_policies_composed
 * Notes: Policies are summarized here to keep the adaptive contract compact.
 */
import type { ExecutionProfile } from "../../bridges/contracts/execution-profile";

export interface ComposedProfilePolicies {
  memoryPolicy: string;
  retrievalPolicy: string;
  reflectionPolicy: string;
  validationPolicy: string;
  proactivityPolicy: string;
  humanizationPolicy: string;
  responsePolicy: string;
}

function pickStrongest<T extends string>(values: T[], fallback: T): T {
  if (!values.length) return fallback;
  if (values.includes("heavy" as T)) return "heavy" as T;
  if (values.includes("standard" as T)) return "standard" as T;
  if (values.includes("light" as T)) return "light" as T;
  return values[0] || fallback;
}

export function composeProfilePolicies(profiles: ExecutionProfile[]): ComposedProfilePolicies {
  return {
    memoryPolicy: pickStrongest(profiles.map((profile) => profile.memoryPolicy), "light"),
    retrievalPolicy: pickStrongest(profiles.map((profile) => profile.retrievalPolicy), "light"),
    reflectionPolicy: pickStrongest(profiles.map((profile) => profile.reflectionPolicy), "light"),
    validationPolicy: pickStrongest(profiles.map((profile) => profile.validationPolicy), "standard"),
    proactivityPolicy: profiles[0]?.proactivityPolicy || "low",
    humanizationPolicy: profiles[0]?.humanizationPolicy || "balanced",
    responsePolicy: profiles[0]?.preferredFormat || "plain-text",
  };
}
