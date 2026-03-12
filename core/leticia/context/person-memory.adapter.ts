import { LeticiaPersonMemoryRepository } from "../memory/person-memory.repository";
import { LeticiaRelationshipGraphRepository } from "../memory/relationship-graph.repository";

export class LeticiaPersonMemoryAdapter {
  constructor(
    private readonly repository = new LeticiaPersonMemoryRepository(),
    private readonly relationshipRepository = new LeticiaRelationshipGraphRepository(),
  ) {}

  async load(personNodeId: string) {
    const [memory, relationships, observations] = await Promise.all([
      this.repository.fetchRelevantMemory(personNodeId),
      this.relationshipRepository.fetchRelationships(personNodeId),
      this.repository.fetchRecentObservations(personNodeId),
    ]);

    return {
      memory,
      relationships,
      observations,
    };
  }
}

