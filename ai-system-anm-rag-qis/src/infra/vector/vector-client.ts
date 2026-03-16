import { vectorIndexConfig } from "./index-config";

export interface VectorClient {
  search: (query: string, topK: number) => Promise<Array<{ id: string; score: number; text: string }>>;
}

export function createVectorClient(): VectorClient {
  return {
    async search() {
      return [];
    },
  };
}

export const vectorClientInfo = {
  endpoint: vectorIndexConfig.endpoint,
  dimensions: vectorIndexConfig.dimensions,
};
