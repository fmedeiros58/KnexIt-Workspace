import { LETICIA } from "../core/config";
import { getNode } from "./registry";
import { routeTopK, RoutePick } from "./router";
import { MyelinLocal } from "./myelinLocal";
import { tokens, jaccard } from "./similarity";

const myelins = new Map<string, MyelinLocal>();
function M(nodeId: string) {
  if (!myelins.has(nodeId)) myelins.set(nodeId, new MyelinLocal(150, 0.997));
  return myelins.get(nodeId)!;
}

async function rawInfer(prompt: string, temperature = 0.6) {
  const { getLeticiaSession } = await import("../_llmAdapter");
  const session = await getLeticiaSession();
  const out = await session.prompt(prompt, {
    temperature,
    topP: 0.9,
    repeatPenalty: 1.05,
    maxTokens: LETICIA.superposition.maxTokens,
  });
  return String(out ?? "");
}

export async function runNodes(input: string, history: string[], topK = 2) {
  const picks: RoutePick[] = routeTopK(input, topK);
  const beams = LETICIA.superposition.beams ?? [];

  const candidates = await Promise.all(
    picks.map(async (pick) => {
      const node = getNode(pick.id);
      if (!node) {
        return { nodeId: pick.id, text: "", route: pick.score, cached: false, score: { faith: 0, rel: 0, style: 0, sum: 0 } };
      }

      const my = M(node.id);
      const extras = (node.preHints ?? []).join(" ");
      const key = my.key(input, node.system, extras);
      const hit = my.get(key);
      if (hit) return { nodeId: node.id, text: hit.output, route: pick.score, cached: true };

      const base = `Sistema: ${node.system}
Diretrizes: ${extras}
Contexto:
${history.join("\n")}
Pergunta: ${input}`;

      // fallback seguro caso beams esteja vazio
      const chosen =
        beams.length > 0
          ? beams.reduce((a, b) =>
              Math.abs(b.temperature - 0.4) < Math.abs(a.temperature - 0.4) ? b : a
            )
          : { temperature: 0.6 };

      const text = await rawInfer(base, (chosen as any).temperature ?? 0.6);

      const faith = 0.7;
      const rel = jaccard(tokens(text), tokens(input));
      const style = /\d\./.test(text) ? 0.6 : 0.4;
      const sum =
        LETICIA.scoring.faithfulnessW * faith +
        LETICIA.scoring.relevanceW * rel +
        LETICIA.scoring.styleW * style;

      my.learn(key, { input, output: text }, sum);
      my.decay();

      return { nodeId: node.id, text, route: pick.score, cached: false, score: { faith, rel, style, sum } };
    })
  );

  const alpha = LETICIA.nodes.weightRouter;
  const best = candidates
    .slice()
    .sort(
      (a: any, b: any) =>
        (1 - alpha) * ((b?.score?.sum ?? 0)) + alpha * (b?.route ?? 0) -
        ((1 - alpha) * ((a?.score?.sum ?? 0)) + alpha * (a?.route ?? 0))
    )[0];

  return { picks, candidates, best };
}
