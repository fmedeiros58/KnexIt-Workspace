import { createVectorDatabaseClient, type VectorDatabaseClient } from "@/core/database/vector-client";
import type { LeticiaMemoryItem, LeticiaResolvedPerson } from "../types";
import { compactWhitespace, normalizeForMatch } from "../utils/text";

type ResolvePersonInput = {
  displayName?: string | null;
  canonicalName?: string | null;
  entityKey?: string | null;
  identityPersonId?: string | null;
  nominalName?: string | null;
  linkConfidence?: number;
  sourceSystem?: string;
  metadata?: Record<string, unknown>;
};

type DialogueTurnInput = {
  personNodeId?: string | null;
  conversationKey?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  locale?: string | null;
  source?: string;
  metadata?: Record<string, unknown>;
};

export class LeticiaPersonMemoryRepository {
  constructor(private readonly vectorDb: VectorDatabaseClient = createVectorDatabaseClient()) {}

  async resolveOrCreatePerson(input: ResolvePersonInput): Promise<LeticiaResolvedPerson | null> {
    const displayName = compactWhitespace(input.displayName || input.nominalName || input.entityKey || "Visitante");
    const canonicalName = compactWhitespace(input.canonicalName || input.nominalName || input.entityKey || displayName) || null;
    const metadataJson = JSON.stringify(input.metadata || {});
    const identityPersonId = compactWhitespace(input.identityPersonId || "") || null;
    const entityKey = compactWhitespace(input.entityKey || "") || null;
    const nominalName = compactWhitespace(input.nominalName || "") || null;
    const sourceSystem = compactWhitespace(input.sourceSystem || "") || "identity_runtime";
    const linkConfidence = Math.max(0, Math.min(1, input.linkConfidence ?? 0.5));

    return this.vectorDb.withClient(async (client) => {
      await client.query("begin");
      try {
        const byIdentity = identityPersonId
          ? await client.query<{
              person_node_id: string;
              display_name: string;
              canonical_name: string | null;
            }>(
              `
                select pn.person_node_id, pn.display_name, pn.canonical_name
                from knex_leticia.person_identity_links pil
                join knex_leticia.person_nodes pn on pn.person_node_id = pil.person_node_id
              where pil.identity_person_id = $1
                order by pil.updated_at desc
                limit 1
              `,
              [identityPersonId],
            )
          : null;

        const byEntity = !byIdentity?.rows?.length && entityKey
          ? await client.query<{
              person_node_id: string;
              display_name: string;
              canonical_name: string | null;
            }>(
              `
                select pn.person_node_id, pn.display_name, pn.canonical_name
                from knex_leticia.person_identity_links pil
                join knex_leticia.person_nodes pn on pn.person_node_id = pil.person_node_id
              where pil.identity_entity_key = $1
                order by pil.updated_at desc
                limit 1
              `,
              [entityKey],
            )
          : null;

        const normalizedLookup = normalizeForMatch(canonicalName || displayName);
        const byName =
          !byIdentity?.rows?.length && !byEntity?.rows?.length
            ? await client.query<{
                person_node_id: string;
                display_name: string;
                canonical_name: string | null;
              }>(
                `
                  select person_node_id, display_name, canonical_name
                  from knex_leticia.person_nodes
                  where lower(coalesce(canonical_name, display_name)) = $1
                  limit 1
                `,
                [normalizedLookup],
              )
            : null;

        const existing = byIdentity?.rows?.[0] || byEntity?.rows?.[0] || byName?.rows?.[0];
        let person = existing;

        if (!person) {
          const inserted = await client.query<{
            person_node_id: string;
            display_name: string;
            canonical_name: string | null;
          }>(
            `
              insert into knex_leticia.person_nodes (
                display_name,
                canonical_name,
                metadata
              )
              values ($1, $2, $3::jsonb)
              returning person_node_id, display_name, canonical_name
            `,
            [displayName, normalizedLookup, metadataJson],
          );
          person = inserted.rows[0];
        } else if (displayName && (displayName !== person.display_name || normalizedLookup !== (person.canonical_name || null))) {
          await client.query(
            `
              update knex_leticia.person_nodes
              set display_name = $2,
                  canonical_name = coalesce($3, canonical_name),
                  metadata = metadata || $4::jsonb
              where person_node_id = $1
            `,
            [person.person_node_id, displayName, normalizedLookup, metadataJson],
          );
        }

        if (person && (identityPersonId || entityKey || nominalName)) {
          if (identityPersonId) {
            const updatedCanonical = await client.query<{ person_identity_link_id: number }>(
              `
                update knex_leticia.person_identity_links
                set
                  person_node_id = $2,
                  identity_entity_key = coalesce($3, identity_entity_key),
                  nominal_name = coalesce($4, nominal_name),
                  source_system = $5,
                  confidence = greatest(confidence, $6),
                  metadata = metadata || $7::jsonb,
                  updated_at = now()
                where identity_person_id = $1
                returning person_identity_link_id
              `,
              [identityPersonId, person.person_node_id, entityKey, nominalName, sourceSystem, linkConfidence, metadataJson],
            );

            if (!updatedCanonical.rows.length) {
              await client.query(
                `
                  insert into knex_leticia.person_identity_links (
                    person_node_id,
                    identity_person_id,
                    identity_entity_key,
                    nominal_name,
                    source_system,
                    confidence,
                    metadata
                  )
                  values ($1, $2, $3, $4, $5, $6, $7::jsonb)
                `,
                [person.person_node_id, identityPersonId, entityKey, nominalName, sourceSystem, linkConfidence, metadataJson],
              );
            }
          }

          if (entityKey) {
            await client.query(
              `
                insert into knex_leticia.person_identity_links (
                  person_node_id,
                  identity_person_id,
                  identity_entity_key,
                  nominal_name,
                  source_system,
                  confidence,
                  metadata
                )
                values ($1, $2, $3, $4, $5, $6, $7::jsonb)
                on conflict (person_node_id, identity_entity_key)
                where identity_entity_key is not null
                do update set
                  identity_person_id = coalesce(excluded.identity_person_id, knex_leticia.person_identity_links.identity_person_id),
                  nominal_name = coalesce(excluded.nominal_name, knex_leticia.person_identity_links.nominal_name),
                  source_system = excluded.source_system,
                  confidence = greatest(knex_leticia.person_identity_links.confidence, excluded.confidence),
                  metadata = knex_leticia.person_identity_links.metadata || excluded.metadata,
                  updated_at = now()
              `,
              [person.person_node_id, identityPersonId, entityKey, nominalName, sourceSystem, linkConfidence, metadataJson],
            );
          }
        }

        await client.query("commit");
        return {
          personNodeId: person.person_node_id,
          displayName: displayName || person.display_name,
          canonicalName: person.canonical_name,
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });
  }

  async insertDialogueTurn(input: DialogueTurnInput) {
    const result = await this.vectorDb.query<{ dialogue_turn_id: string }>(
      `
        insert into knex_leticia.dialogue_turns (
          person_node_id,
          conversation_key,
          role,
          content,
          locale,
          source,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        returning dialogue_turn_id
      `,
      [
        input.personNodeId || null,
        input.conversationKey || null,
        input.role,
        input.content,
        input.locale || null,
        input.source || "proactive_assistant",
        JSON.stringify(input.metadata || {}),
      ],
    );
    return result.rows[0]?.dialogue_turn_id || null;
  }

  async insertObservation(input: {
    personNodeId?: string | null;
    identityPersonId?: string | null;
    identityEntityKey?: string | null;
    observationKind: string;
    content: string;
    confidence?: number;
    payload?: Record<string, unknown>;
  }) {
    await this.vectorDb.query(
      `
        insert into knex_leticia.person_observations (
          person_node_id,
          identity_person_id,
          identity_entity_key,
          observation_kind,
          content,
          confidence,
          payload
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        input.personNodeId || null,
        input.identityPersonId || null,
        input.identityEntityKey || null,
        input.observationKind,
        input.content,
        Math.max(0, Math.min(1, input.confidence ?? 0.5)),
        JSON.stringify(input.payload || {}),
      ],
    );
  }

  async insertMemoryCandidate(input: {
    personNodeId: string;
    sourceTurnId?: string | null;
    memoryKind: string;
    candidateText: string;
    normalizedValue?: string | null;
    confidence: number;
    metadata?: Record<string, unknown>;
  }) {
    const result = await this.vectorDb.query<{ memory_candidate_id: string }>(
      `
        insert into knex_leticia.memory_candidates (
          person_node_id,
          source_turn_id,
          memory_kind,
          candidate_text,
          normalized_value,
          confidence,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        returning memory_candidate_id
      `,
      [
        input.personNodeId,
        input.sourceTurnId || null,
        input.memoryKind,
        input.candidateText,
        input.normalizedValue || null,
        input.confidence,
        JSON.stringify(input.metadata || {}),
      ],
    );
    return result.rows[0]?.memory_candidate_id || null;
  }

  async markMemoryCandidateStatus(memoryCandidateId: string, status: "accepted" | "rejected" | "merged") {
    await this.vectorDb.query(
      `update knex_leticia.memory_candidates set status = $2 where memory_candidate_id = $1`,
      [memoryCandidateId, status],
    );
  }

  async upsertMemoryItem(input: {
    personNodeId: string;
    sourceCandidateId?: string | null;
    memoryKind: string;
    content: string;
    normalizedValue?: string | null;
    confidence: number;
    importance?: number;
    metadata?: Record<string, unknown>;
  }) {
    const result = await this.vectorDb.query<{
      person_memory_item_id: string;
    }>(
      `
        insert into knex_leticia.person_memory_items (
          person_node_id,
          source_candidate_id,
          memory_kind,
          content,
          normalized_value,
          confidence,
          importance,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        on conflict (person_node_id, memory_kind, normalized_value)
        where normalized_value is not null
        do update set
          content = excluded.content,
          confidence = greatest(knex_leticia.person_memory_items.confidence, excluded.confidence),
          importance = greatest(knex_leticia.person_memory_items.importance, excluded.importance),
          metadata = knex_leticia.person_memory_items.metadata || excluded.metadata,
          updated_at = now()
        returning person_memory_item_id
      `,
      [
        input.personNodeId,
        input.sourceCandidateId || null,
        input.memoryKind,
        input.content,
        input.normalizedValue || null,
        input.confidence,
        Math.max(0, Math.min(1, input.importance ?? input.confidence)),
        JSON.stringify(input.metadata || {}),
      ],
    );
    return result.rows[0]?.person_memory_item_id || null;
  }

  async upsertMemoryEmbedding(personMemoryItemId: string, embedding: number[], embeddingModel: string) {
    const literal = `[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]`;
    await this.vectorDb.query(
      `
        insert into knex_leticia.person_memory_embeddings (
          person_memory_item_id,
          embedding,
          embedding_model
        )
        values ($1, $2::vector, $3)
        on conflict (person_memory_item_id)
        do update set
          embedding = excluded.embedding,
          embedding_model = excluded.embedding_model
      `,
      [personMemoryItemId, literal, embeddingModel],
    );
  }

  async fetchRelevantMemory(personNodeId: string, limit = 6) {
    const result = await this.vectorDb.query<{
      person_memory_item_id: string;
      person_node_id: string;
      memory_kind: string;
      content: string;
      normalized_value: string | null;
      confidence: number;
      importance: number;
      created_at: string;
      updated_at: string;
    }>(
      `
        select
          person_memory_item_id,
          person_node_id,
          memory_kind,
          content,
          normalized_value,
          confidence,
          importance,
          created_at,
          updated_at
        from knex_leticia.person_memory_items
        where person_node_id = $1
          and status = 'active'
        order by importance desc, updated_at desc
        limit $2
      `,
      [personNodeId, limit],
    );

    return result.rows.map<LeticiaMemoryItem>((row) => ({
      personMemoryItemId: row.person_memory_item_id,
      personNodeId: row.person_node_id,
      memoryKind: row.memory_kind,
      content: row.content,
      normalizedValue: row.normalized_value,
      confidence: Number(row.confidence),
      importance: Number(row.importance),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async fetchRecentObservations(personNodeId: string, limit = 4) {
    const result = await this.vectorDb.query<{ content: string }>(
      `
        select content
        from knex_leticia.person_observations
        where person_node_id = $1
        order by created_at desc
        limit $2
      `,
      [personNodeId, limit],
    );
    return result.rows.map((row) => row.content);
  }
}
