export type ResponseComplexity =
  | "micro"
  | "short"
  | "medium"
  | "long"
  | "deep";

export type RhetoricalShape =
  | "single_compact_paragraph"
  | "two_paragraph_explanation"
  | "multi_paragraph_analysis"
  | "headed_analysis"
  | "enumerated_technical"
  | "hybrid";

export type ListStrategy =
  | "avoid"
  | "minimal"
  | "allowed"
  | "preferred";

export type HeadingStrategy =
  | "none"
  | "light"
  | "moderate";

export type ResponseLayoutPlan = {
  complexity: ResponseComplexity;
  rhetoricalShape: RhetoricalShape;
  targetParagraphSentenceRange: [number, number];
  targetParagraphCharRange: [number, number];
  listStrategy: ListStrategy;
  headingStrategy: HeadingStrategy;
  mergeAggressiveness: number;
  flushThreshold: number;
  allowSingleSentenceParagraphs: boolean;
  keepDenseParagraphs: boolean;
  preserveCodeBlocks: boolean;
  preserveCitationBlocks: boolean;
  preserveMediaBlocks: boolean;
  notes: string[];
};

export type ParagraphCandidate = {
  sentences: string[];
  charLength: number;
  semanticCohesion: number;
  topicShiftScore: number;
  shouldFlush: boolean;
};

export type TextualAudit = {
  passed: boolean;
  score: number;
  issues: string[];
  repairedText?: string;
};

export type ResponseLayoutPolicyInput = {
  text: string;
  prompt: string;
  hasCodeBlocks: boolean;
  hasCitations: boolean;
  hasMedia: boolean;
  hasEnumerativeSignals: boolean;
  requestedList: boolean;
  requestedHeading: boolean;
};

export type ParagraphCohesionSample = {
  previous: string;
  current: string;
  lexicalOverlap: number;
  connectorContinuity: number;
  contrastSignal: number;
  semanticCohesion: number;
  topicShiftScore: number;
};

export type ParagraphAssemblerInput = {
  sentences: string[];
  plan: ResponseLayoutPlan;
};

export type ParagraphAssemblerOutput = {
  paragraphs: string[];
  candidates: ParagraphCandidate[];
};
