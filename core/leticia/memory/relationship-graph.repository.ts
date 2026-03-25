import { createVectorDatabaseClient, type VectorDatabaseClient } from "@/core/database/vector-client";
import type { LeticiaRelationship } from "../types";
import { compactWhitespace, normalizeForMatch } from "../utils/text";

export class LeticiaRelationshipGraphRepository {
  constructor(private readonly vectorDb: VectorDatabaseClient = createVectorDatabaseClient()) {}

  async resolveOrCreateRelatedPerson(displayName: string) {
    const safeDisplayName = compactWhitespace(displayName);
    const normalized = normalizeForMatch(safeDisplayName);
    const found = await this.vectorDb.query<{ person_node_id: string; display_name: string }>(
      `
        select person_node_id, display_name
        from knex_leticia.person_nodes
        where lower(coalesce(canonical_name, display_name)) = $1
        limit 1
      `,
      [normalized],
    );
    if (found.rows[0]) {
      return {
        personNodeId: found.rows[0].person_node_id,
        displayName: found.rows[0].display_name,
      };
    }

    const inserted = await this.vectorDb.query<{ person_node_id: string; display_name: string }>(
      `
        insert into knex_leticia.person_nodes (
          display_name,
          canonical_name,
          metadata
        )
        values ($1, $2, '{}'::jsonb)
        returning person_node_id, display_name
      `,
      [safeDisplayName, normalized],
    );
    return {
      personNodeId: inserted.rows[0].person_node_id,
      displayName: inserted.rows[0].display_name,
    };
  }

  async upsertRelationship(input: {
    sourcePersonNodeId: string;
    targetPersonNodeId: string;
    relationType: string;
    relationScore: number;
    sourceMemoryItemId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    await this.vectorDb.query(
      `
        insert into knex_leticia.person_relationships (
          source_person_node_id,
          target_person_node_id,
          relation_type,
          relation_score,
          source_memory_item_id,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6::jsonb)
        on conflict (source_person_node_id, target_person_node_id, relation_type)
        do update set
          relation_score = greatest(knex_leticia.person_relationships.relation_score, excluded.relation_score),
          source_memory_item_id = coalesce(excluded.source_memory_item_id, knex_leticia.person_relationships.source_memory_item_id),
          metadata = knex_leticia.person_relationships.metadata || excluded.metadata,
          updated_at = now()
      `,
      [
        input.sourcePersonNodeId,
        input.targetPersonNodeId,
        input.relationType,
        Math.max(0, Math.min(1, input.relationScore)),
        input.sourceMemoryItemId || null,
        JSON.stringify(input.metadata || {}),
      ],
    );
  }

  async fetchRelationships(personNodeId: string, limit = 6) {
    const result = await this.vectorDb.query<{
      target_person_node_id: string;
      display_name: string;
      relation_type: string;
      relation_score: number;
    }>(
      `
        select
          pr.target_person_node_id,
          pn.display_name,
          pr.relation_type,
          pr.relation_score
        from knex_leticia.person_relationships pr
        join knex_leticia.person_nodes pn on pn.person_node_id = pr.target_person_node_id
        where pr.source_person_node_id = $1
        order by pr.relation_score desc, pr.updated_at desc
        limit $2
      `,
      [personNodeId, limit],
    );

    return result.rows.map<LeticiaRelationship>((row) => ({
      targetPersonNodeId: row.target_person_node_id,
      targetDisplayName: row.display_name,
      relationType: row.relation_type,
      relationScore: Number(row.relation_score),
    }));
  }
}

