import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getEnabledSources } from "@/lib/knexreview/sourceRegistry";
import { deduplicate } from "@/lib/knexreview/deduplication";
import type { GenericSearchStrategy, SearchResultRecord, SourceId } from "@/lib/knexreview/types";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { strategy?: GenericSearchStrategy; sources?: SourceId[] } | null;
  if (!body?.strategy || !Array.isArray(body.sources)) {
    return NextResponse.json({ error: "strategy e sources são obrigatórios" }, { status: 400 });
  }
  const enabled = getEnabledSources(process.env);
  const wanted = new Set(body.sources);
  const adapters = enabled.filter((a) => wanted.has(a.id));
  const allResults: SearchResultRecord[] = [];
  const bySource: Record<string, { count: number }> = {};

  for (const adapter of adapters) {
    try {
      const query = adapter.buildQuery(body.strategy);
      const results = await adapter.runQuery(query);
      bySource[adapter.id] = { count: results.length };
      allResults.push(...results);
    } catch (e) {
      bySource[adapter.id] = { count: 0 };
    }
  }

  const deduped = deduplicate(allResults);
  return NextResponse.json({ results: deduped, bySource });
}
