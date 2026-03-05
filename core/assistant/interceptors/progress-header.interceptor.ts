import { ProgressHeaderBuilder } from "@/core/assistant/progress/progress-header.builder";
import type { PipelineLanguage } from "@/core/assistant/pipeline/pipeline-context";
import type { ProgressSignals } from "@/core/assistant/progress/progress-signals";
import type { ProgressHeaderMode, ProgressHeaderStyle, ProgressHeaderTarget } from "@/core/assistant/progress/progress-header.mode";

function buildPrefixedContent(header: string, content: string) {
  const safeHeader = `${header || ""}`.trim();
  const safeContent = `${content || ""}`.trim();
  if (!safeHeader) return safeContent;
  if (!safeContent) return safeHeader;
  return `${safeHeader}\n\n${safeContent}`.trim();
}

function prefixPlainTextStream(stream: ReadableStream<Uint8Array>, prefixText: string) {
  const prefix = `${prefixText || ""}`.trim();
  if (!prefix) return stream;
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`${prefix}\n\n`));
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

export type ProgressHeaderInterceptorInput = {
  responseMode: "chat" | "write";
  progress: ProgressSignals;
  language?: PipelineLanguage;
  requestId?: string;
  mode?: ProgressHeaderMode;
  style?: ProgressHeaderStyle;
  target?: ProgressHeaderTarget;
};

export class ProgressHeaderInterceptor {
  constructor(private readonly builder = new ProgressHeaderBuilder()) {}

  applyToContent(content: string, input: ProgressHeaderInterceptorInput) {
    const header = this.builder.build({
      responseMode: input.responseMode,
      progress: input.progress,
      stage: input.progress.stage,
      langTag: input.language?.tag,
      requestId: input.requestId,
      usedRag: input.progress.usedRag,
      readFiles: input.progress.readFiles,
      mode: input.mode,
      style: input.style,
      target: input.target,
    });
    return buildPrefixedContent(header, content);
  }

  applyToPlainStream(stream: ReadableStream<Uint8Array>, input: ProgressHeaderInterceptorInput) {
    const header = this.builder.build({
      responseMode: input.responseMode,
      progress: input.progress,
      stage: input.progress.stage,
      langTag: input.language?.tag,
      requestId: input.requestId,
      usedRag: input.progress.usedRag,
      readFiles: input.progress.readFiles,
      mode: input.mode,
      style: input.style,
      target: input.target,
    });
    return prefixPlainTextStream(stream, header);
  }
}
