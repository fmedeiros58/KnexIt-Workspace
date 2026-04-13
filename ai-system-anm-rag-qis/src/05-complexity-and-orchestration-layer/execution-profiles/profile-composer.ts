/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/profile-composer
 * Responsibility: Compose selected profiles into a stable weighted result.
 * Primary Inputs: Selected profile ids and fused routing decision.
 * Primary Outputs: ProfileSelectionResult and concrete profile list.
 * Upstream Dependencies: profile-catalog, profile-priority-rules
 * Downstream Dependencies: activation-policy, adaptive contract builder, orchestration-layer
 * Invariants: Weight normalization is deterministic and uses motor hints when available.
 * Failure Modes: Unknown profile ids are ignored and the selection falls back to conversational-light-profile.
 * Audit Events: profile_selection_composed
 * Notes: Composition remains declarative and does not execute layers.
 */
import type { ProfileSelectionResult } from "../../bridges/contracts/profile-selection-result";
import type { ExecutionProfile } from "../../bridges/contracts/execution-profile";
import type { FusedRoutingDecision } from "../llm-routing/routing-analysis-types";
import { executionProfileCatalogById, PROFILE_CATALOG_VERSION } from "./profile-catalog";
import { sortProfileIdsByPriority } from "./profile-priority-rules";

export interface ProfileCompositionResult {
  profiles: ExecutionProfile[];
  selection: ProfileSelectionResult;
}

export function composeExecutionProfiles(
  profileIds: string[],
  fusedDecision: FusedRoutingDecision,
): ProfileCompositionResult {
  const orderedIds = sortProfileIdsByPriority(profileIds);
  const profiles = orderedIds
    .map((profileId) => executionProfileCatalogById[profileId])
    .filter((profile): profile is ExecutionProfile => Boolean(profile));

  const effectiveProfiles = profiles.length
    ? profiles
    : [executionProfileCatalogById["conversational-light-profile"]];

  const rawWeights = Object.fromEntries(
    effectiveProfiles.map((profile, index) => [
      profile.id,
      fusedDecision.profileWeights[profile.id] ?? Number((1 / (index + 1)).toFixed(4)),
    ]),
  );
  const totalWeight = Object.values(rawWeights).reduce((sum, value) => sum + value, 0) || 1;
  const normalizedWeights = Object.fromEntries(
    Object.entries(rawWeights).map(([profileId, value]) => [profileId, Number((value / totalWeight).toFixed(4))]),
  );

  return {
    profiles: effectiveProfiles,
    selection: {
      primaryProfileId: effectiveProfiles[0].id,
      selectedProfileIds: effectiveProfiles.map((profile) => profile.id),
      weights: normalizedWeights,
      reasons: fusedDecision.dominantSignals,
      dominantSignals: fusedDecision.dominantSignals,
      catalogVersion: PROFILE_CATALOG_VERSION,
    },
  };
}
