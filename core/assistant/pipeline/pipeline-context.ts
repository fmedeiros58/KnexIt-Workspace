import type { ProgressSignals } from "@/core/assistant/progress/progress-signals";
import type { AcademicGenre } from "@/core/assistant/genre/academic-genre.types";
import type { StructureQualityMetrics } from "@/core/assistant/postprocess/generic-structure.enforcer";
import type { TemplateSpec } from "@/core/assistant/templates/template-spec";
import type { RagQueryInput, RagQueryResult } from "@/core/rag/rag-query-service";
import type { RagChatHistoryItem } from "@/core/rag/vllm-client";

export type ConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type PipelineAttachment = {
  id: string;
  kind: "file" | "url";
  mime?: string;
  name?: string;
};

export type PipelineIntent = {
  type: string;
  confidence: number;
};

export type PipelineLanguage = {
  tag: string;
  iso3: string;
  confidence: number;
};

export type EvidenceItem = {
  source: "rag" | "file" | "memory";
  ref: string;
  score: number;
  text: string;
};

export type PipelinePlan = {
  sections: Array<{ title: string; bullets?: string[] }>;
};

export type PipelineContext = {
  requestId: string;
  conversationKey: string;
  mode: "chat" | "write";
  stream: boolean;
  userMessage: string;
  conversation: ConversationMessage[];
  constraints: string[];
  intent?: PipelineIntent;
  attachments: PipelineAttachment[];
  ragInput: Omit<RagQueryInput, "question" | "history" | "requestId">;
  evidence: EvidenceItem[];
  processState: Record<string, unknown> | null;
  persistentPrefs: Record<string, unknown> | null;
  language?: PipelineLanguage;
  genre?: AcademicGenre;
  genreConfidence?: number;
  templateSpec?: TemplateSpec;
  plan?: PipelinePlan;
  progress: ProgressSignals;
  qualityGate?: StructureQualityMetrics;
  draftAnswer?: string;
  finalAnswer?: string;
  ragRuntimeMode?: "lite" | "full";
  draftStream?: ReadableStream<Uint8Array>;
  finalStream?: ReadableStream<Uint8Array>;
  ragMetadata?: RagQueryResult["metadata"];
};

export function toRagHistory(conversation: ConversationMessage[]): RagChatHistoryItem[] {
  const normalized: RagChatHistoryItem[] = [];
  for (const row of conversation || []) {
    if (!row || typeof row.content !== "string") continue;
    const content = row.content.trim();
    if (!content) continue;
    if (row.role === "user" || row.role === "assistant") {
      normalized.push({ role: row.role, content });
      continue;
    }
    if (row.role === "system") {
      normalized.push({ role: "assistant", content: `[contexto do sistema]\n${content}` });
    }
  }
  return normalized;
}
