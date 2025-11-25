export function cosine(a: number[], b: number[]) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const na = Math.sqrt(a.reduce((s, v) => s + v*v, 0));
  const nb = Math.sqrt(b.reduce((s, v) => s + v*v, 0));
  return dot / (na * nb + 1e-8);
}

// stub: você pode substituir por embeddings locais quando integrar
export async function pseudoEmbedding(text: string): Promise<number[]> {
  // hash simples p/ protótipo (troque por embedding real local)
  const arr = new Array(256).fill(0);
  for (let i = 0; i < text.length; i++) arr[i % 256] += text.charCodeAt(i) % 13;
  const norm = Math.sqrt(arr.reduce((s,n)=>s+n*n,0)) || 1;
  return arr.map(n => n / norm);
}

export async function resonanceScore(anchor: string, recent: string, candidate: string) {
  const [ea, er, ec] = await Promise.all([
    pseudoEmbedding(anchor || "vazio"),
    pseudoEmbedding(recent || "vazio"),
    pseudoEmbedding(candidate || "vazio"),
  ]);
  // coerência como média das similaridades
  return (cosine(ea, ec) + cosine(er, ec)) / 2;
}
