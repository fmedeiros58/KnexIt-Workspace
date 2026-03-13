export interface ModelConfig {
  baseUrl: string;
  modelName: string;
  timeoutMs: number;
}

export const modelConfig: ModelConfig = {
  baseUrl: process.env.ANM_VLLM_URL || "http://127.0.0.1:8000/v1",
  modelName: process.env.ANM_MODEL_NAME || "mistral-awq",
  timeoutMs: Number(process.env.ANM_LLM_TIMEOUT_MS || 45000),
};
