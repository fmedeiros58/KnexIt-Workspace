export type SegmentKind =
  | "internal"
  | "heading"
  | "paragraph"
  | "fragment"
  | "conclusion"
  | "list";

export interface TextSegment {
  raw: string;
  cleaned: string;
  normalized: string;
  kind: SegmentKind;
  score: number;
}

export interface EnforceStructureOptions {
  preserveHeadings?: boolean;
  mergeFragments?: boolean;
  semanticDedupThreshold?: number;
}
