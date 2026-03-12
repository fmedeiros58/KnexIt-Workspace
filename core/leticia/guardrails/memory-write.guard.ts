import type { LeticiaMemoryCandidate } from "../types";

export function shouldPersistMemoryCandidate(candidate: LeticiaMemoryCandidate) {
  if (!candidate.candidateText.trim()) return false;
  if (candidate.confidence < 0.66) return false;
  if (candidate.memoryKind === "relationship") {
    const relationType = typeof candidate.metadata.relationType === "string" ? candidate.metadata.relationType.trim() : "";
    const targetName = typeof candidate.metadata.targetName === "string" ? candidate.metadata.targetName.trim() : "";
    return Boolean(relationType && targetName);
  }
  return true;
}

