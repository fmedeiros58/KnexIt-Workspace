export type LeticiaLocale = "pt-BR" | "en-US" | "es-ES";

export type LeticiaIntentName =
  | "greeting"
  | "gratitude"
  | "farewell"
  | "confirmation"
  | "negation"
  | "help_request"
  | "question"
  | "command"
  | "statement"
  | "ambiguous";

export type LeticiaDialogueMode =
  | "social"
  | "direct_answer"
  | "clarify"
  | "assist"
  | "command"
  | "contextual";

export type LeticiaIntent = {
  name: LeticiaIntentName;
  locale: LeticiaLocale;
  normalizedText: string;
  confidence: number;
  expectsDirectReply: boolean;
  isMicroTurn: boolean;
};

export type LeticiaIdentityContext = {
  entityKey: string | null;
  identityPersonId: string | null;
  identityScope: "permanent" | "temporary" | "test" | null;
  identityPersistent: boolean;
  displayName: string | null;
  nominalName: string | null;
  label: string | null;
  sourceId: string | null;
  confidence: number;
  someoneInFrame: boolean;
  identityConfirmed: boolean;
  visualSource: string | null;
};

export type LeticiaSceneEvent = {
  eventType: string;
  summary: string;
  at: string | null;
  entityKey: string | null;
  label: string | null;
  sourceId: string | null;
  confidence: number;
};

export type LeticiaVisualContext = {
  sceneSummary: string | null;
  presenceDurationMs: number;
  currentInterlocutorDurationMs: number;
  currentInterlocutorStable: boolean;
  currentInterlocutorPersistenceLevel: number;
  currentInterlocutorEntityId: string | null;
  currentInterlocutorLabel: string | null;
  sourceId: string | null;
  interlocutorSwitched: boolean;
  trackedEntitiesCount: number;
  recentSceneEvents: LeticiaSceneEvent[];
};

export type LeticiaRelationship = {
  targetPersonNodeId: string;
  targetDisplayName: string;
  relationType: string;
  relationScore: number;
};

export type LeticiaMemoryItem = {
  personMemoryItemId: string;
  personNodeId: string;
  memoryKind: string;
  content: string;
  normalizedValue: string | null;
  confidence: number;
  importance: number;
  createdAt: string;
  updatedAt: string;
};

export type LeticiaResolvedPerson = {
  personNodeId: string;
  displayName: string;
  canonicalName: string | null;
};

export type LeticiaSituationalContext = {
  locale: LeticiaLocale;
  identity: LeticiaIdentityContext;
  visual: LeticiaVisualContext;
  sharedPromptBlock: string;
  person: LeticiaResolvedPerson | null;
  memory: LeticiaMemoryItem[];
  relationships: LeticiaRelationship[];
  observations: string[];
};

export type LeticiaMemoryCandidate = {
  memoryKind: "identity" | "preference" | "fact" | "relationship" | "context" | "profile";
  candidateText: string;
  normalizedValue: string | null;
  confidence: number;
  metadata: Record<string, unknown>;
};

export type LeticiaTurnPlan = {
  mode: LeticiaDialogueMode;
  directReply: string | null;
  promptPrefix: string;
};
