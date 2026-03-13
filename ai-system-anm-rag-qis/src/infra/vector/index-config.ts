export interface VectorConfig {
  endpoint: string;
  dimensions: number;
}

export const vectorIndexConfig: VectorConfig = {
  endpoint: process.env.ANM_VECTOR_ENDPOINT || "http://127.0.0.1:54322",
  dimensions: Number(process.env.ANM_VECTOR_DIMENSIONS || 768),
};
