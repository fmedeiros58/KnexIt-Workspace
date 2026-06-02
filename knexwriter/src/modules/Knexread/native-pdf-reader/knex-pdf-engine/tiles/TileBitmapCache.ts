export type TileBitmapCacheOptions<TValue> = {
  maxTiles?: number;
  maxBytes?: number;
  maxEntryBytes?: number;
  maxEntryAgeMs?: number;
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

function safePositiveInteger(
  value: number | null | undefined,
  fallback: number,
): number {
  return Math.max(
    1,
    Math.trunc(typeof value === "number" && Number.isFinite(value) ? value : fallback),
  );
}

/**
 * Cache LRU defensivo para bitmaps de tiles.
 *
 * Este cache é um ponto crítico de memória:
 * ImageBitmap não é coletado de forma previsível enquanto houver referência
 * forte. Portanto, todo descarte precisa chamar dispose(), que normalmente
 * executa bitmap.close().
 *
 * A política abaixo evita três problemas comuns em zoom alto:
 * - um único tile grande demais entrando no cache;
 * - tiles antigos de gerações anteriores permanecendo vivos;
 * - prune custoso por sort repetido em loop.
 */
export class TileBitmapCache<TValue> {
  private readonly maxTiles: number;
  private readonly maxBytes: number;
  private readonly maxEntryBytes: number;
  private readonly maxEntryAgeMs: number;
  private readonly estimateBytes: (value: TValue) => number;
  private readonly dispose?: (value: TValue, key: string) => void;
  private readonly entries = new Map<string, TileBitmapCacheEntry<TValue>>();
  private currentBytes = 0;

  constructor(options: TileBitmapCacheOptions<TValue> = {}) {
    this.maxTiles = safePositiveInteger(options.maxTiles, 96);
    this.maxBytes = safePositiveInteger(options.maxBytes, 96 * 1024 * 1024);

    /*
     * Um único bitmap não deve ocupar grande parte do orçamento do cache.
     * Por padrão, cada entrada fica limitada a 1/8 do orçamento total.
     */
    this.maxEntryBytes = safePositiveInteger(
      options.maxEntryBytes,
      Math.max(1, Math.floor(this.maxBytes / 8)),
    );

    /*
     * TTL defensivo. Mesmo que ainda haja espaço, tiles antigos de gerações
     * passadas não devem ficar vivos indefinidamente.
     */
    this.maxEntryAgeMs = safePositiveInteger(options.maxEntryAgeMs, 45_000);

    this.estimateBytes =
      options.estimateBytes ?? ((value) => estimateDefaultBytes(value));
    this.dispose = options.dispose;
  }

  get size() {
    this.pruneExpired();
    return this.entries.size;
  }

  get bytes() {
    this.pruneExpired();
    return this.currentBytes;
  }

  get maxSize() {
    return this.maxTiles;
  }

  get maxMemoryBytes() {
    return this.maxBytes;
  }

  get maxSingleEntryBytes() {
    return this.maxEntryBytes;
  }

  get(key: string): TValue | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.delete(key);
      return undefined;
    }

    entry.lastUsedAt = Date.now();
    entry.hits += 1;

    return entry.value;
  }

  peek(key: string): TValue | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.peek(key) !== undefined;
  }

  set(key: string, value: TValue, bytes = this.estimateBytes(value)): boolean {
    this.delete(key);
    this.pruneExpired();

    const safeBytes = Math.max(0, Math.trunc(Number.isFinite(bytes) ? bytes : 0));

    /*
     * Não cachear itens grandes demais.
     *
     * Importante: mesmo recusando a entrada, chamamos dispose(value, key) para
     * liberar ImageBitmap criado pelo chamador. Sem isso, a tentativa de cache
     * ainda deixaria memória presa até o GC.
     */
    if (safeBytes > this.maxEntryBytes || safeBytes > this.maxBytes) {
      this.safeDispose(value, key);
      return false;
    }

    const now = Date.now();
    const entry: TileBitmapCacheEntry<TValue> = {
      key,
      value,
      bytes: safeBytes,
      createdAt: now,
      lastUsedAt: now,
      hits: 0,
    };

    this.entries.set(key, entry);
    this.currentBytes += entry.bytes;
    this.prune();

    return this.entries.has(key);
  }

  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    this.entries.delete(key);
    this.currentBytes = Math.max(0, this.currentBytes - entry.bytes);
    this.safeDispose(entry.value, key);

    return true;
  }

  clear() {
    for (const key of [...this.entries.keys()]) {
      this.delete(key);
    }
  }

  /**
   * Remove entradas que pertençam a uma geração/documento específico.
   *
   * Útil quando o zoom muda e uma geração inteira fica obsoleta.
   */
  deleteWhere(predicate: (entry: Readonly<TileBitmapCacheEntry<TValue>>) => boolean) {
    for (const entry of [...this.entries.values()]) {
      if (predicate(entry)) {
        this.delete(entry.key);
      }
    }
  }

  /**
   * Permite reduzir o cache manualmente sob pressão de memória.
   */
  trimTo(input: { maxTiles?: number; maxBytes?: number }) {
    const targetMaxTiles = Math.max(
      0,
      Math.trunc(input.maxTiles ?? this.maxTiles),
    );
    const targetMaxBytes = Math.max(
      0,
      Math.trunc(input.maxBytes ?? this.maxBytes),
    );

    while (
      this.entries.size > targetMaxTiles ||
      this.currentBytes > targetMaxBytes
    ) {
      const victim = this.findLeastRecentlyUsedEntry();
      if (!victim) return;
      this.delete(victim.key);
    }
  }

  private isExpired(entry: TileBitmapCacheEntry<TValue>): boolean {
    return Date.now() - entry.createdAt > this.maxEntryAgeMs;
  }

  private pruneExpired() {
    for (const entry of [...this.entries.values()]) {
      if (this.isExpired(entry)) {
        this.delete(entry.key);
      }
    }
  }

  private prune() {
    this.pruneExpired();

    while (
      this.entries.size > this.maxTiles ||
      this.currentBytes > this.maxBytes
    ) {
      const victim = this.findLeastRecentlyUsedEntry();
      if (!victim) return;
      this.delete(victim.key);
    }
  }

  private findLeastRecentlyUsedEntry(): TileBitmapCacheEntry<TValue> | null {
    let victim: TileBitmapCacheEntry<TValue> | null = null;

    for (const entry of this.entries.values()) {
      if (
        !victim ||
        entry.lastUsedAt < victim.lastUsedAt ||
        (entry.lastUsedAt === victim.lastUsedAt &&
          entry.createdAt < victim.createdAt)
      ) {
        victim = entry;
      }
    }

    return victim;
  }

  private safeDispose(value: TValue, key: string) {
    try {
      this.dispose?.(value, key);
    } catch {
      /*
       * O dispose normalmente chama ImageBitmap.close().
       * Se o bitmap já tiver sido fechado, não podemos deixar isso quebrar o
       * fluxo de renderização/cache.
       */
    }
  }
}
