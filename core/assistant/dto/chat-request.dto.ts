import type { ConversationMessage } from "@/core/assistant/pipeline/pipeline-context";

export type AssistantAttachmentDto = {
  id: string;
  kind: "file" | "url";
  mime?: string;
  name?: string;
};

export type ChatRequestDto = {
  mode?: "chat" | "write";
  message: string;
  conversation?: ConversationMessage[];
  attachments?: AssistantAttachmentDto[];
};
