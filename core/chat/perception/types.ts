export type ConversationChatRole = "user" | "assistant";

export type ConversationChatHistoryItem = {
  role: ConversationChatRole;
  content: string;
};

export type ConversationContinuityMode = "continue" | "adjust" | "replace";

export type ConversationPerceptionState = {
  active_topic: string;
  active_subtopic: string;
  active_task: string;
  active_text_reference: string;
  user_constraints: string[];
  required_style: string;
  response_mode: string;
  unresolved_pending_point: string;
  last_contextual_decision: string;
  continuity_anchor: string;
  continuity_mode: ConversationContinuityMode;
  updated_at: number;
};

export type ConversationPerceptionInput = {
  conversationKey: string;
  prompt: string;
  history: ConversationChatHistoryItem[];
  localeHint?: string;
};

export type PersistentInstructionState = {
  requiredStyle: string;
  userConstraints: string[];
  responseMode: string;
};

