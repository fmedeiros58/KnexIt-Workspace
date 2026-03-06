import { AssistantController } from "@/core/assistant/assistant.controller";
import { createAssistantPipelineOrchestratorService } from "@/core/assistant/pipeline/pipeline-orchestrator.service";
import type { RagQueryService } from "@/core/rag/rag-query-service";

export class AssistantModule {
  static create(ragService: RagQueryService) {
    const orchestrator = createAssistantPipelineOrchestratorService(ragService);
    const controller = new AssistantController(orchestrator);
    return {
      orchestrator,
      controller,
    };
  }
}

