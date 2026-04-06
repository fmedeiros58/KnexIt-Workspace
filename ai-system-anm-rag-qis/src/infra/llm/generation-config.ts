export interface GenerationConfig {
  maxTokens: number;
  temperature: number;
  topP: number;
}

export const generationConfig: GenerationConfig = {
  maxTokens: Number(process.env.AI_SYSTEM_ANM_MAX_TOKENS || 8192),
  temperature: Number(process.env.AI_SYSTEM_ANM_TEMPERATURE || 0.2),
  topP: Number(process.env.AI_SYSTEM_ANM_TOP_P || 0.9),
};
