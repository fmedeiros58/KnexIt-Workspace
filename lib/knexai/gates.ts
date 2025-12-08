import { ModSignal } from "./modulators";

export type GateWeights = { [beamId: string]: number };

export function computeGate(signals: ModSignal[], beamIds: string[]): GateWeights {
  // base uniforme
  const w: GateWeights = Object.fromEntries(beamIds.map(id => [id, 1]));
  for (const s of signals) {
    if (s.tags.includes("math")) { w["cold"] = (w["cold"] ?? 1) * (1 + 0.6*s.strength); }
    if (s.tags.includes("style")){ w["creative"] = (w["creative"] ?? 1) * (1 + 0.4*s.strength); }
    if (s.tags.includes("safety")){ /* pode reduzir creative, aumentar cold */ 
      w["creative"] = (w["creative"] ?? 1) * (1 - 0.5*s.strength);
      w["cold"]     = (w["cold"] ?? 1)     * (1 + 0.3*s.strength);
    }
  }
  // normaliza
  const sum = Object.values(w).reduce((a,b)=>a+b,0) || 1;
  for (const k of Object.keys(w)) w[k] /= sum;
  return w;
}
