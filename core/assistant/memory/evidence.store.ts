import type { EvidenceItem } from "@/core/assistant/pipeline/pipeline-context";

const EVIDENCE_MAP =
  (globalThis as { __assistantEvidenceStore?: Map<string, EvidenceItem[]> }).__assistantEvidenceStore ??
  new Map<string, EvidenceItem[]>();

(globalThis as { __assistantEvidenceStore?: Map<string, EvidenceItem[]> }).__assistantEvidenceStore = EVIDENCE_MAP;

export class EvidenceStore {
  async save(requestId: string, evidence: EvidenceItem[]) {
    EVIDENCE_MAP.set(requestId, [...evidence]);
  }

  async get(requestId: string) {
    return EVIDENCE_MAP.get(requestId) || [];
  }
}

