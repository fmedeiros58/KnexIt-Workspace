export function tokens(s: string) {
  return s.toLowerCase().normalize("NFD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/).filter(Boolean);
}
export function jaccard(a: string[], b: string[]) {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter(x => B.has(x)).length;
  const uni = new Set([...A, ...B]).size;
  return uni ? inter/uni : 0;
}
export function simText(a: string, b: string) { return jaccard(tokens(a), tokens(b)); }
