import { detectLanguage } from "@/core/assistant/language/language.utils";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { toRagHistory } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";
import type { RagQueryService } from "@/core/rag/rag-query-service";
import { logger } from "@/core/utils/logger";

function normalizeTag(tag: string) {
  const value = `${tag || ""}`.trim().toLowerCase();
  if (!value) return "";
  return value.split("-")[0];
}

function isLanguageMismatch(expectedTag: string, detectedTag: string) {
  if (!expectedTag || !detectedTag) return false;
  return normalizeTag(expectedTag) !== normalizeTag(detectedTag);
}

export class LanguageGuardStage implements Stage {
  constructor(private readonly ragService: RagQueryService) {}

  async run(ctx: PipelineContext) {
    if (ctx.stream) return;
    const targetTag = `${ctx.language?.tag || "pt-BR"}`.trim();
    const answer = `${ctx.finalAnswer || ctx.draftAnswer || ""}`.trim();
    if (!answer) return;

    const detected = detectLanguage(answer);
    if (!isLanguageMismatch(targetTag, detected.tag)) return;

    logger.warn("ASSISTANT_LANGUAGE_GUARD_REWRITE", {
      requestId: ctx.requestId,
      expectedLanguage: targetTag,
      detectedLanguage: detected.tag,
      detectedIso3: detected.iso3,
      detectedConfidence: detected.confidence,
    });

    const rewritePrompt = [
      `Reescreva o texto abaixo em ${targetTag}.`,
      "Preserve integralmente o sentido, os fatos, a estrutura e o nível de detalhe.",
      "Nao resuma e nao adicione conteúdo novo.",
      "",
      "TEXTO:",
      answer,
    ].join("\n");

    const rewritten = await this.ragService.query({
      ...ctx.ragInput,
      question: rewritePrompt,
      history: toRagHistory(ctx.conversation),
      requestId: `${ctx.requestId}:language-guard`,
      preferredResponseLanguageId: targetTag,
      pipelineModeOverride: ctx.ragRuntimeMode === "lite" ? "lite" : ctx.ragInput.pipelineModeOverride,
      maxResponseTokens:
        ctx.ragRuntimeMode === "lite" ? Math.min(768, ctx.ragInput.maxResponseTokens ?? 768) : ctx.ragInput.maxResponseTokens,
    });
    const rewrittenAnswer = `${rewritten.answer || ""}`.trim();
    if (rewrittenAnswer) {
      ctx.finalAnswer = rewrittenAnswer;
      ctx.ragMetadata = rewritten.metadata;
    }
  }
}
