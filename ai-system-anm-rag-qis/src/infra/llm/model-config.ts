export interface ModelConfig {
  baseUrl: string;
  modelName: string;
  timeoutMs: number;
}

function resolveDefaultBaseUrl() {
  if (process.env.KUBERNETES_SERVICE_HOST) {
    return "http://vllm:8000/v1";
  }
  return "http://127.0.0.1:8000/v1";
}

export const modelConfig: ModelConfig = {
  baseUrl:
    process.env.AI_SYSTEM_ANM_VLLM_URL ||
    process.env.LOCAL_LLM_BASE_URL ||
    process.env.VLLM_BASE_URL ||
    resolveDefaultBaseUrl(),
  modelName: process.env.AI_SYSTEM_ANM_MODEL_NAME || "mistral-awq",
  timeoutMs: Number(process.env.AI_SYSTEM_ANM_LLM_TIMEOUT_MS || 45000),
};
