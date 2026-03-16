import { webConfig } from "./web-config";

export interface SearchClient {
  search: (query: string) => Promise<Array<{ title: string; url: string; snippet: string }>>;
}

export function createSearchClient(): SearchClient {
  return {
    async search() {
      return [];
    },
  };
}

export const searchClientInfo = {
  providers: webConfig.providers,
};
