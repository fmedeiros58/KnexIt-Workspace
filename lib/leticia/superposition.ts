// lib/leticia/superposition.ts
export type Candidate = { id: string; text: string; meta?: any; scores: {faith:number;rel:number;style:number;sum:number} };

export function tokens(s:string){ return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,"").split(/\s+/).filter(Boolean); }
export function jaccard(a:string[],b:string[]){ const A=new Set(a),B=new Set(b); const i=[...A].filter(x=>B.has(x)).length; const u=new Set([...A,...B]).size; return u? i/u:0; }
export function similarity(a:string,b:string){ return jaccard(tokens(a), tokens(b)); }
export function clamp(x:number,lo:number,hi:number){ return Math.max(lo, Math.min(hi, x)); }

export function score(id:string, text:string, input:string, ctx:string[]): Candidate {
  const faith = 0.7; // placeholder
  const rel   = clamp(similarity(text, input) * 0.9 + similarity(text, ctx.join(" ")) * 0.1, 0, 1);
  const style = clamp((/\d\./.test(text) ? 0.6 : 0.3) + (text.length>100?0.2:0), 0, 1);
  const sum = 0.5*faith + 0.3*rel + 0.2*style;
  return { id, text, scores:{faith,rel,style,sum} };
}

export function select(cands: Candidate[]): Candidate {
  return cands.sort((a,b)=>b.scores.sum - a.scores.sum)[0];
}
