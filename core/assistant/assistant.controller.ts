import type { ChatRequestDto } from "@/core/assistant/dto/chat-request.dto";
import type { PipelineOrchestratorService } from "@/core/assistant/pipeline/pipeline-orchestrator.service";

export class AssistantController {
  constructor(private readonly orchestrator: PipelineOrchestratorService) {}

  async chat(dto: ChatRequestDto) {
    return this.orchestrator.run({
      mode: dto.mode || "chat",
      message: dto.message,
      conversation: dto.conversation,
      attachments: dto.attachments,
    });
  }
}

