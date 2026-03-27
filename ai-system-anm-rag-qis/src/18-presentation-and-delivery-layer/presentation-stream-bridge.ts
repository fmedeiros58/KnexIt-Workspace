import type { ProcessingState } from "../bridges/contracts/processing-state";
import { streamChunkSerializer, type StreamChunkSerializerOutput } from "./output-serializer/stream-chunk-serializer";
import type { DeliveryChannel, StreamChunk } from "./presentation-contracts";
import { paragraphFlushLogic } from "./streaming-controller/paragraph-flush-logic";
import { progressiveRevealManager } from "./streaming-controller/progressive-reveal-manager";
import { sentenceBuffering } from "./streaming-controller/sentence-buffering";
import { streamRecoveryManager } from "./streaming-controller/stream-recovery-manager";
import { tokenStreamManager } from "./streaming-controller/token-stream-manager";

export interface PresentationStreamBridgeInput {
  text: string;
  channel: DeliveryChannel;
}

export interface PresentationStreamBridgeOutput {
  chunks: StreamChunk[];
  serialized: StreamChunkSerializerOutput;
  recovered: boolean;
}

export function buildPresentationStream(input: PresentationStreamBridgeInput): PresentationStreamBridgeOutput {
  const tokens = tokenStreamManager({ text: input.text });
  const sentences = sentenceBuffering({ tokens: tokens.tokens });
  const paragraphs = paragraphFlushLogic({ sentences: sentences.sentences });
  const reveal = progressiveRevealManager({ paragraphs: paragraphs.paragraphs });
  const recovered = streamRecoveryManager({
    chunks: reveal.chunks,
    fallbackText: input.text,
  });

  const mode = input.channel === "sse" ? "sse" : input.channel === "websocket" ? "websocket" : "plain";
  const serialized = streamChunkSerializer({ chunks: recovered.chunks, mode });

  return {
    chunks: recovered.chunks,
    serialized,
    recovered: recovered.recovered,
  };
}

export function handoffPresentationToStream(state: ProcessingState): ProcessingState {
  return state;
}
