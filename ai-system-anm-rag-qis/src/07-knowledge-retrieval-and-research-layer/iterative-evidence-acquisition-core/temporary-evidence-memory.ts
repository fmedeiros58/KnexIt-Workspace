/**
 * Responsabilidade do arquivo:
 * - Manter memoria transitora por TTL para bundles de evidencia.
 * - Reaproveitar buscas recentes e reduzir latencia/custo.
 * - Evitar persistencia indevida: cache apenas operacional.
 */
import { buildQuerySignature } from "../../shared/state/query-signature";
import type { IterativeEvidenceBundle } from "./iterative-acquisition-types";

interface CachedBundle {
  signature: string;
  storedAt: number;
  ttlMs: number;
  bundle: IterativeEvidenceBundle;
}

const CACHE = new Map<string, CachedBundle>();
const DEFAULT_TTL_MS = 3 * 60 * 1000;

function makeKey(signature: string): string {
  return `iterative:${signature}`;
}

function isExpired(record: CachedBundle): boolean {
  return (Date.now() - record.storedAt) > record.ttlMs;
}

export function readTemporaryEvidenceBundle(query: string): IterativeEvidenceBundle | null {
  const signature = buildQuerySignature(query);
  const cached = CACHE.get(makeKey(signature));
  if (!cached) return null;
  if (isExpired(cached)) {
    CACHE.delete(makeKey(signature));
    return null;
  }
  return cached.bundle;
}

export function writeTemporaryEvidenceBundle(
  query: string,
  bundle: IterativeEvidenceBundle,
  ttlMs = DEFAULT_TTL_MS,
): void {
  const signature = buildQuerySignature(query);
  CACHE.set(makeKey(signature), {
    signature,
    storedAt: Date.now(),
    ttlMs: Math.max(1_000, ttlMs),
    bundle,
  });
}

export function sweepTemporaryEvidenceMemory(): number {
  let removed = 0;
  for (const [key, cached] of CACHE.entries()) {
    if (isExpired(cached)) {
      CACHE.delete(key);
      removed += 1;
    }
  }
  return removed;
}

