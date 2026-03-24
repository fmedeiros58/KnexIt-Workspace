import type { StreamChunk } from "../presentation-contracts";

export interface StreamRecoveryManagerInput {
  chunks: StreamChunk[];
  fallbackText: string;
}

export interface StreamRecoveryManagerOutput {
  ok: boolean;
  component: string;
  score: number;
  chunks: StreamChunk[];
  recovered: boolean;
}

export function streamRecoveryManager(input: StreamRecoveryManagerInput): StreamRecoveryManagerOutput {
  const chunks = [...(input.chunks || [])];
  if (chunks.length > 0) {
    return {
      ok: true,
      component: "stream-recovery-manager",
      score: 0.92,
      chunks,
      recovered: false,
    };
  }

  const fallbackText = `${input.fallbackText || ""}`.trim();
  const fallbackChunk: StreamChunk = {
    index: 0,
    delta: fallbackText,
    cumulativeText: fallbackText,
    done: true,
  };

  return {
    ok: true,
    component: "stream-recovery-manager",
    score: fallbackText ? 0.74 : 0.32,
    chunks: [fallbackChunk],
    recovered: true,
  };
}
