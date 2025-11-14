import { listNodes } from "./registry";
import { simText } from "./similarity";

export type RoutePick = { id: string; score: number };

export function routeTopK(input: string, k=2): RoutePick[] {
  const nodes = listNodes();
  const picks = nodes.map(n => ({
    id: n.id,
    score: simText(input, n.keywords.join(" ")),
  })).sort((a: RoutePick, b: RoutePick) => b.score - a.score);
  return picks.slice(0, Math.max(1, Math.min(k, picks.length)));
}
