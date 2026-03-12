import type { IdentityRuntimeSharedContext } from "@/core/identity/shared-memory-context";
import { createVectorDatabaseClient, type VectorDatabaseClient } from "@/core/database/vector-client";
import type { LeticiaIdentityContext } from "../types";

type CanonicalPersonRow = {
  person_id: string;
  display_name: string;
  profile_kind: string | null;
  identity_scope: "permanent" | "temporary" | "test" | null;
  is_archived: boolean | null;
  expires_at: string | null;
  strong_similarity_threshold: number | null;
};

type CanonicalIdentityMatchRow = CanonicalPersonRow & {
  candidate_image_key: string | null;
  similarity_score: number;
  match_status: string | null;
  entity_key: string | null;
  source_key: string | null;
};

export type LeticiaCanonicalIdentityProfile = {
  identityPersonId: string;
  displayName: string | null;
  profileKind: string | null;
  identityScope: "permanent" | "temporary" | "test" | null;
  identityPersistent: boolean;
  confidence: number;
  resolvedBy: "identity_context" | "entity_match" | "recent_match" | "entity_metadata";
  entityKey: string | null;
  sourceId: string | null;
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function clamp01(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function parseTimestampMs(value: unknown) {
  const candidate = asText(value);
  if (!candidate) return 0;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickIdentityKey(metadata: Record<string, unknown>, voiceProfileKey: string | null) {
  const candidates = [
    metadata.identity_person_id,
    metadata.person_id,
    metadata.personId,
    metadata.user_key,
    metadata.userKey,
    metadata.subject_id,
    metadata.subjectId,
    voiceProfileKey,
  ];
  for (const candidate of candidates) {
    const normalized = asText(candidate);
    if (normalized) return normalized;
  }
  return "";
}

function asIdentityScope(value: unknown) {
  const normalized = asText(value).toLowerCase();
  if (normalized === "permanent" || normalized === "temporary" || normalized === "test") {
    return normalized;
  }
  return null;
}

export class LeticiaCanonicalIdentityResolver {
  constructor(private readonly vectorDb: VectorDatabaseClient = createVectorDatabaseClient()) {}

  async resolve(input: LeticiaIdentityContext, sharedContext?: IdentityRuntimeSharedContext | null) {
    const profile = await this.resolveProfile(input, sharedContext);
    return profile?.identityPersonId || null;
  }

  async resolveProfile(
    input: LeticiaIdentityContext,
    sharedContext?: IdentityRuntimeSharedContext | null,
  ): Promise<LeticiaCanonicalIdentityProfile | null> {
    const directIdentity = asText(input.identityPersonId);
    if (directIdentity) {
      const person = await this.fetchCanonicalPerson(directIdentity);
      if (person) {
        return {
          identityPersonId: person.person_id,
          displayName: asText(person.display_name) || input.displayName || input.nominalName || input.label || null,
          profileKind: person.profile_kind || null,
          identityScope: asIdentityScope(person.identity_scope),
          identityPersistent: this.isPersistentCanonicalPerson(person),
          confidence: Math.max(input.confidence, 0.9),
          resolvedBy: "identity_context",
          entityKey: input.entityKey,
          sourceId: input.sourceId,
        };
      }
      return {
        identityPersonId: directIdentity,
        displayName: input.displayName || input.nominalName || input.label || null,
        profileKind: null,
        identityScope: input.identityScope,
        identityPersistent: input.identityPersistent,
        confidence: Math.max(input.confidence, 0.85),
        resolvedBy: "identity_context",
        entityKey: input.entityKey,
        sourceId: input.sourceId,
      };
    }

    const byEntity = await this.resolveFromEntityMatch(input.entityKey, input.sourceId);
    if (byEntity) {
      return {
        identityPersonId: byEntity.person_id,
        displayName: asText(byEntity.display_name) || input.displayName || input.nominalName || input.label || null,
        profileKind: byEntity.profile_kind || null,
        identityScope: asIdentityScope(byEntity.identity_scope),
        identityPersistent: this.isPersistentCanonicalPerson(byEntity),
        confidence: this.resolveMatchConfidence(byEntity),
        resolvedBy: "entity_match",
        entityKey: asText(byEntity.entity_key) || input.entityKey,
        sourceId: asText(byEntity.source_key) || input.sourceId,
      };
    }

    const byRecentMatch = await this.resolveFromRecentMatches(sharedContext);
    if (byRecentMatch) {
      return {
        identityPersonId: byRecentMatch.person_id,
        displayName: asText(byRecentMatch.display_name) || input.displayName || input.nominalName || input.label || null,
        profileKind: byRecentMatch.profile_kind || null,
        identityScope: asIdentityScope(byRecentMatch.identity_scope),
        identityPersistent: this.isPersistentCanonicalPerson(byRecentMatch),
        confidence: this.resolveMatchConfidence(byRecentMatch),
        resolvedBy: "recent_match",
        entityKey: asText(byRecentMatch.entity_key) || input.entityKey,
        sourceId: asText(byRecentMatch.source_key) || input.sourceId,
      };
    }

    const byMetadata = await this.resolveFromEntityMetadata(input);
    if (byMetadata) {
      return byMetadata;
    }

    return null;
  }

  private async fetchCanonicalPerson(identityPersonId: string) {
    const result = await this.vectorDb.query<CanonicalPersonRow>(
      `
        select person_id, display_name, profile_kind, strong_similarity_threshold
             , identity_scope, is_archived, expires_at
        from knex_identity_runtime.identity_persons
        where person_id = $1
        limit 1
      `,
      [identityPersonId],
    );
    return result.rows[0] || null;
  }

  private async resolveFromEntityMatch(entityKey: string | null, sourceId: string | null) {
    const normalizedEntity = asText(entityKey);
    if (!normalizedEntity) return null;

    const params: unknown[] = [normalizedEntity];
    let sourceFilter = "";
    const normalizedSource = asText(sourceId);
    if (normalizedSource) {
      params.push(normalizedSource);
      sourceFilter = ` and coalesce(m.source_key, '') = $${params.length}`;
    }

    const result = await this.vectorDb.query<CanonicalIdentityMatchRow>(
      `
        select
          r.person_id,
          p.display_name,
          p.profile_kind,
          p.identity_scope,
          p.is_archived,
          p.expires_at,
          p.strong_similarity_threshold,
          m.candidate_image_key,
          m.similarity_score,
          m.match_status,
          m.entity_key,
          m.source_key
        from knex_identity_runtime.identity_embedding_matches m
        join knex_identity_runtime.identity_person_reference_images r
          on r.image_key = m.candidate_image_key
         and r.is_active = true
        join knex_identity_runtime.identity_persons p
          on p.person_id = r.person_id
         and coalesce(p.is_archived, false) = false
         and (p.expires_at is null or p.expires_at > now())
        where m.entity_key = $1
          ${sourceFilter}
        order by
          case when m.match_status = 'positive' then 0 else 1 end,
          m.similarity_score desc,
          m.updated_at desc
        limit 3
      `,
      params,
    );

    for (const row of result.rows) {
      if (this.isTrustedMatch(row)) return row;
    }
    return null;
  }

  private async resolveFromRecentMatches(sharedContext?: IdentityRuntimeSharedContext | null) {
    const recentMatches = [...(sharedContext?.snapshot?.recentMatches || [])]
      .filter((row) => {
        const status = asText(row.status).toLowerCase();
        const similarity = Number(row.similarity || 0);
        const threshold = Number(row.threshold || 0.82);
        return status === "positive" || similarity >= threshold;
      })
      .sort((left, right) => parseTimestampMs(right.updatedAt) - parseTimestampMs(left.updatedAt))
      .slice(0, 6);

    const candidateImageKeys = Array.from(
      new Set(recentMatches.map((row) => asText(row.candidateImageKey)).filter(Boolean)),
    );
    if (!candidateImageKeys.length) return null;

    const result = await this.vectorDb.query<CanonicalIdentityMatchRow>(
      `
        select
          r.person_id,
          p.display_name,
          p.profile_kind,
          p.identity_scope,
          p.is_archived,
          p.expires_at,
          p.strong_similarity_threshold,
          r.image_key as candidate_image_key,
          coalesce(m.similarity_score, 0) as similarity_score,
          m.match_status,
          m.entity_key,
          m.source_key
        from knex_identity_runtime.identity_person_reference_images r
        join knex_identity_runtime.identity_persons p
          on p.person_id = r.person_id
         and coalesce(p.is_archived, false) = false
         and (p.expires_at is null or p.expires_at > now())
        left join knex_identity_runtime.identity_embedding_matches m
          on m.candidate_image_key = r.image_key
        where r.image_key = any($1::text[])
          and r.is_active = true
        order by
          case when m.match_status = 'positive' then 0 else 1 end,
          m.similarity_score desc nulls last,
          r.updated_at desc
        limit 6
      `,
      [candidateImageKeys],
    );

    for (const preferred of recentMatches) {
      const preferredKey = asText(preferred.candidateImageKey);
      const preferredEntity = asText(preferred.entityKey);
      const preferredSource = asText(preferred.sourceKey);
      const row = result.rows.find((item) => {
        const rowEntity = asText(item.entity_key);
        const rowSource = asText(item.source_key);
        return (!preferredEntity || rowEntity === preferredEntity) && (!preferredSource || rowSource === preferredSource);
      });
      if (row && this.isTrustedMatch(row)) {
        return {
          ...row,
          entity_key: preferredEntity || row.entity_key,
          source_key: preferredSource || row.source_key,
        };
      }

      const fallbackRow = result.rows.find((item) => {
        const sameCandidate = preferredKey && preferredKey === asText(item.candidate_image_key);
        return sameCandidate || !preferredKey;
      });
      if (fallbackRow) {
        return {
          ...fallbackRow,
          entity_key: preferredEntity || fallbackRow.entity_key,
          source_key: preferredSource || fallbackRow.source_key,
          similarity_score: Math.max(Number(fallbackRow.similarity_score || 0), Number(preferred.similarity || 0)),
          match_status: asText(preferred.status) || fallbackRow.match_status,
        };
      }
    }

    return result.rows.find((row) => this.isTrustedMatch(row)) || null;
  }

  private async resolveFromEntityMetadata(input: LeticiaIdentityContext): Promise<LeticiaCanonicalIdentityProfile | null> {
    const conditions: string[] = [];
    const params: string[] = [];
    if (input.entityKey) {
      params.push(input.entityKey);
      conditions.push(`entity_key = $${params.length}`);
    }
    if (input.nominalName) {
      params.push(input.nominalName.toLowerCase());
      conditions.push(`lower(nominal_name) = $${params.length}`);
    }
    if (input.label) {
      params.push(input.label.toLowerCase());
      conditions.push(`lower(display_label) = $${params.length}`);
    }
    if (!conditions.length) return null;

    const result = await this.vectorDb.query<{
      voice_profile_key: string | null;
      metadata: Record<string, unknown> | null;
    }>(
      `
        select voice_profile_key, metadata
        from knex_identity_runtime.identity_entities
        where ${conditions.join(" or ")}
        order by updated_at desc
        limit 6
      `,
      params,
    );

    for (const row of result.rows) {
      const key = pickIdentityKey(asObject(row.metadata), row.voice_profile_key);
      if (!key) continue;
      const person = await this.fetchCanonicalPerson(key);
      return {
        identityPersonId: key,
        displayName: person?.display_name || input.displayName || input.nominalName || input.label || null,
        profileKind: person?.profile_kind || null,
        identityScope: person ? asIdentityScope(person.identity_scope) : null,
        identityPersistent: person ? this.isPersistentCanonicalPerson(person) : false,
        confidence: Math.max(input.confidence, 0.75),
        resolvedBy: "entity_metadata",
        entityKey: input.entityKey,
        sourceId: input.sourceId,
      };
    }

    return null;
  }

  private isTrustedMatch(row: Pick<CanonicalIdentityMatchRow, "match_status" | "similarity_score" | "strong_similarity_threshold">) {
    const status = asText(row.match_status).toLowerCase();
    const similarity = Number(row.similarity_score || 0);
    const threshold = Number(row.strong_similarity_threshold || 0.82);
    return status === "positive" || similarity >= threshold;
  }

  private resolveMatchConfidence(row: Pick<CanonicalIdentityMatchRow, "similarity_score" | "strong_similarity_threshold" | "match_status">) {
    const status = asText(row.match_status).toLowerCase();
    if (status === "positive") return 0.96;
    const similarity = clamp01(row.similarity_score, 0.82);
    const threshold = clamp01(row.strong_similarity_threshold, 0.82);
    return Math.max(similarity, threshold);
  }

  private isPersistentCanonicalPerson(person: Pick<CanonicalPersonRow, "identity_scope" | "is_archived" | "expires_at">) {
    const scope = asIdentityScope(person.identity_scope);
    const archived = Boolean(person.is_archived);
    const expired = Boolean(asText(person.expires_at)) && parseTimestampMs(person.expires_at) <= Date.now();
    return scope === "permanent" && !archived && !expired;
  }
}
