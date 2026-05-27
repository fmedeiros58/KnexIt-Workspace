export type TileBitmapCacheOptions<TValue> = {
  maxTiles?: number;
  maxBytes?: number;
  estimateBytes?: (value: TValue) => number;
  dispose?: (value: TValue, key: string) => void;
};

type TileBitmapCacheEntry<TValue> = {
  key: string;
  value: TValue;
  bytes: number;
  createdAt: number;
  lastUsedAt: number;
  hits: number;
};

function estimateDefaultBytes(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "width" in value &&
    "height" in value
  ) {
    const record = value as { width?: unknown; height?: unknown };
    if (typeof record.width === "number" && typeof record.height === "number") {
      return Math.max(0, record.width * record.height * 4);
    }
  }

  return 0;
}

export class TileBitmapCache<TValue> {
  private readonly maxTiles: number;
  private readonly maxBytes: number;
  private readonly estimateBytes: (value: TValue) => number;
  private readonly dispose?: (value: TValue, key: string) => void;
  private readonly entries = new Map<string, TileBitmapCacheEntry<TValue>>();
  private currentBytes = 0;

  constructor(options: TileBitmapCacheOptions<TValue> = {}) {
    this.maxTiles = Math.max(1, Math.trunc(options.maxTiles ?? 256));
    this.maxBytes = Math.max(1, Math.trunc(options.maxBytes ?? 256 * 1024 * 1024));
    this.estimateBytes =
      options.estimateBytes ?? ((value) => estimateDefaultBytes(value));
    this.dispose = options.dispose;
  }

  get size() {
    return this.entries.size;
  }

  get bytes() {
    return this.currentBytes;
  }

  get(key: string): TValue | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    entry.lastUsedAt = Date.now();
    entry.hits += 1;
    return entry.value;
  }

  peek(key: string): TValue | undefined {
    return this.entries.get(key)?.value;
  }

  set(key: string, value: TValue, bytes = this.estimateBytes(value)) {
    this.delete(key);

    const entry: TileBitmapCacheEntry<TValue> = {
      key,
      value,
      bytes: Math.max(0, bytes),
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      hits: 0,
    };

    this.entries.set(key, entry);
    this.currentBytes += entry.bytes;
    this.prune();
  }

  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    this.entries.delete(key);
    this.currentBytes = Math.max(0, this.currentBytes - entry.bytes);
    this.dispose?.(entry.value, key);
    return true;
  }

  clear() {
    for (const key of [...this.entries.keys()]) {
      this.delete(key);
    }
  }

  private prune() {
    while (
      this.entries.size > this.maxTiles ||
      this.currentBytes > this.maxBytes
    ) {
      const oldest = [...this.entries.values()].sort(
        (a, b) => a.lastUsedAt - b.lastUsedAt || a.createdAt - b.createdAt,
      )[0];

      if (!oldest) return;
      this.delete(oldest.key);
    }
  }
}
