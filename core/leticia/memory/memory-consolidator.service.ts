import { createQueryEmbeddingClient, type QueryEmbeddingClient } from "@/core/rag/embedding-client";
import type { LeticiaMemoryCandidate } from "../types";
import { shouldPersistMemoryCandidate } from "../guardrails/memory-write.guard";
import { LeticiaPersonMemoryRepository } from "./person-memory.repository";
import { LeticiaRelationshipGraphRepository } from "./relationship-graph.repository";

export class LeticiaMemoryConsolidatorService {
  constructor(
    private readonly repository = new LeticiaPersonMemoryRepository(),
    private readonly relationshipRepository = new LeticiaRelationshipGraphRepository(),
    private readonly embeddingClient: QueryEmbeddingClient = createQueryEmbeddingClient(),
  ) {}

  async consolidate(personNodeId: string, sourceTurnId: string | null, candidates: LeticiaMemoryCandidate[]) {
    const accepted: string[] = [];

    for (const candidate of candidates) {
      const candidateId = await this.repository.insertMemoryCandidate({
        personNodeId,
        sourceTurnId,
        memoryKind: candidate.memoryKind,
        candidateText: candidate.candidateText,
        normalizedValue: candidate.normalizedValue,
        confidence: candidate.confidence,
        metadata: candidate.metadata,
      });

      if (!candidateId || !shouldPersistMemoryCandidate(candidate)) {
        if (candidateId) await this.repository.markMemoryCandidateStatus(candidateId, "rejected");
        continue;
      }

      const memoryItemId = await this.repository.upsertMemoryItem({
        personNodeId,
        sourceCandidateId: candidateId,
        memoryKind: candidate.memoryKind,
        content: candidate.candidateText,
        normalizedValue: candidate.normalizedValue,
        confidence: candidate.confidence,
        importance: Math.max(candidate.confidence, 0.72),
        metadata: candidate.metadata,
      });

      if (!memoryItemId) {
        await this.repository.markMemoryCandidateStatus(candidateId, "rejected");
        continue;
      }

      try {
        const embedded = await this.embeddingClient.embedQuery(candidate.candidateText);
        await this.repository.upsertMemoryEmbedding(memoryItemId, embedded.vector, embedded.model);
      } catch {
        // melhor-esforco: a memoria relacional deve sobreviver sem embedding
      }

      if (candidate.memoryKind === "relationship") {
        const targetName = typeof candidate.metadata.targetName === "string" ? candidate.metadata.targetName.trim() : "";
        const relationType = typeof candidate.metadata.relationType === "string" ? candidate.metadata.relationType.trim() : "";
        if (targetName && relationType) {
          const target = await this.relationshipRepository.resolveOrCreateRelatedPerson(targetName);
          await this.relationshipRepository.upsertRelationship({
            sourcePersonNodeId: personNodeId,
            targetPersonNodeId: target.personNodeId,
            relationType,
            relationScore: candidate.confidence,
            sourceMemoryItemId: memoryItemId,
            metadata: { source: "leticia_memory_extractor" },
          });
        }
      }

      await this.repository.markMemoryCandidateStatus(candidateId, "accepted");
      accepted.push(candidateId);
    }

    return accepted;
  }
}

