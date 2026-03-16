export interface GenerationConfig {
  maxTokens: number;
  temperature: number;
  topP: number;
}

export const generationConfig: GenerationConfig = {
  maxTokens: Number(process.env.ANM_MAX_TOKENS || 2048),
  temperature: Number(process.env.ANM_TEMPERATURE || 0.2),
  topP: Number(process.env.ANM_TOP_P || 0.9),
};
