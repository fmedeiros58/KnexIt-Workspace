export interface EmbeddingConfig {
  endpoint: string;
  model: string;
}

export const embeddingConfig: EmbeddingConfig = {
  endpoint: process.env.AI_SYSTEM_ANM_EMBEDDING_URL || "http://127.0.0.1:8001/v1",
  model: process.env.AI_SYSTEM_ANM_EMBEDDING_MODEL || "intfloat/multilingual-e5-base",
};
