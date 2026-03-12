import type { IdentityRuntimeSharedContext } from "@/core/identity/shared-memory-context";
import type { IdentityRuntimeSnapshot } from "@/app/api/proactive-assistant/_shared";
import type { LeticiaLocale, LeticiaSituationalContext } from "../types";
import { LeticiaPersonMemoryAdapter } from "./person-memory.adapter";
import { adaptIdentityContext } from "./identity-context.adapter";
import { adaptVisualContext } from "./visual-context.adapter";
import { LeticiaPersonMemoryRepository } from "../memory/person-memory.repository";
import { LeticiaCanonicalIdentityResolver } from "./identity-canonical.resolver";

export class LeticiaSituationalContextService {
  constructor(
    private readonly repository = new LeticiaPersonMemoryRepository(),
    private readonly memoryAdapter = new LeticiaPersonMemoryAdapter(),
    private readonly canonicalResolver = new LeticiaCanonicalIdentityResolver(),
  ) {}

  async build(input: {
    locale: LeticiaLocale;
    identitySnapshot: IdentityRuntimeSnapshot | null;
    sharedIdentityContext: IdentityRuntimeSharedContext | null;
  }): Promise<LeticiaSituationalContext> {
    const identity = adaptIdentityContext(input.identitySnapshot, input.sharedIdentityContext);
    const visual = adaptVisualContext(input.identitySnapshot);
    const canonicalIdentity = await this.canonicalResolver.resolveProfile(identity, input.sharedIdentityContext);
    if (canonicalIdentity) {
      identity.identityPersonId = canonicalIdentity.identityPersonId;
      identity.identityScope = canonicalIdentity.identityScope;
      identity.identityPersistent = canonicalIdentity.identityPersistent;
      identity.displayName = canonicalIdentity.displayName || identity.displayName;
      identity.nominalName = identity.nominalName || canonicalIdentity.displayName;
      identity.entityKey = identity.entityKey || canonicalIdentity.entityKey;
      identity.sourceId = identity.sourceId || canonicalIdentity.sourceId;
      identity.confidence = Math.max(identity.confidence, canonicalIdentity.confidence);
    }

    const shouldAnchorVisualIdentity = identity.identityPersistent && Boolean(identity.identityPersonId || identity.displayName || identity.entityKey);
    const anchoredIdentityPersonId = shouldAnchorVisualIdentity ? identity.identityPersonId : null;
    const person =
      shouldAnchorVisualIdentity
        ? await this.repository.resolveOrCreatePerson({
            displayName: identity.displayName,
            canonicalName: identity.nominalName || identity.label || identity.displayName || identity.identityPersonId,
            entityKey: identity.entityKey,
            identityPersonId: anchoredIdentityPersonId,
            nominalName: identity.nominalName,
            linkConfidence: identity.identityConfirmed && anchoredIdentityPersonId ? Math.max(identity.confidence, 0.9) : identity.confidence,
            metadata: {
              visualSource: identity.visualSource,
              identityConfirmed: identity.identityConfirmed,
              canonicalIdentityAnchored: Boolean(anchoredIdentityPersonId),
              canonicalResolutionSource: canonicalIdentity?.resolvedBy || null,
              identityScope: identity.identityScope,
              identityPersistent: identity.identityPersistent,
            },
          })
        : null;

    const personalContext = person
      ? await this.memoryAdapter.load(person.personNodeId)
      : { memory: [], relationships: [], observations: [] };

    return {
      locale: input.locale,
      identity,
      visual,
      sharedPromptBlock: input.sharedIdentityContext?.promptBlock || "",
      person,
      memory: personalContext.memory,
      relationships: personalContext.relationships,
      observations: personalContext.observations,
    };
  }
}
