import type {
  KnexReadServerTileReadyResponse,
  KnexReadServerTileRequest,
  KnexReadServerTileResponse,
} from "./ServerTileTypes";

function stableStringify(value: unknown): string {
  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function createServerTileRequestHash(
  request: KnexReadServerTileRequest,
): string {
  return stableStringify(request);
}

export class ServerTileCacheClient {
  private readonly readyTiles = new Map<string, KnexReadServerTileReadyResponse>();

  get(request: KnexReadServerTileRequest): KnexReadServerTileReadyResponse | null {
    return this.readyTiles.get(createServerTileRequestHash(request)) ?? null;
  }

  set(
    request: KnexReadServerTileRequest,
    response: KnexReadServerTileResponse,
  ) {
    if (!response.ok) return;

    this.readyTiles.set(createServerTileRequestHash(request), response);
  }

  delete(request: KnexReadServerTileRequest) {
    return this.readyTiles.delete(createServerTileRequestHash(request));
  }

  clear() {
    this.readyTiles.clear();
  }
}
