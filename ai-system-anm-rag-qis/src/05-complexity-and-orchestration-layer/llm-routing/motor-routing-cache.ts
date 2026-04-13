/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: llm-routing/motor-routing-cache
 * Responsibility: Provide short-lived caching for the initial motor routing analysis.
 * Primary Inputs: Stable cache keys derived from normalized input and heuristic hints.
 * Primary Outputs: Cached MotorRoutingAnalysis entries.
 * Upstream Dependencies: lru-cache, fast-json-stable-stringify
 * Downstream Dependencies: motor-routing-client
 * Invariants: Cache lifetime is short and scoped to the initial analysis stage only.
 * Failure Modes: Cache misses simply fall back to runtime execution.
 * Audit Events: motor_routing_cache_hit, motor_routing_cache_set
 * Notes: The cache prevents repeated cost for identical early-stage prompts.
 */
import { LRUCache } from "lru-cache";
import stringify from "fast-json-stable-stringify";
import type { MotorRoutingAnalysis } from "../../bridges/contracts/motor-routing-analysis";

const motorRoutingCache = new LRUCache<string, MotorRoutingAnalysis>({
  max: 128,
  ttl: 1000 * 45,
});

export function buildMotorRoutingCacheKey(input: Record<string, unknown>): string {
  return stringify(input);
}

export function readMotorRoutingCache(key: string): MotorRoutingAnalysis | null {
  return motorRoutingCache.get(key) || null;
}

export function writeMotorRoutingCache(key: string, value: MotorRoutingAnalysis): void {
  motorRoutingCache.set(key, value);
}
