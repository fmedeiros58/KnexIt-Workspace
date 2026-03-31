export interface GreetingFastLanePolicy {
  maxTokenCount: number;
  maxQuestionCount: number;
  maxQuickComplexity: number;
  maxQuickAmbiguity: number;
}

export const GREETING_FAST_LANE_POLICY: GreetingFastLanePolicy = {
  maxTokenCount: 12,
  maxQuestionCount: 1,
  maxQuickComplexity: 0.30,
  maxQuickAmbiguity: 0.34,
};

