import type { VioReadDocument } from "./vioreadTypes";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function requestTranslation(input: { document: VioReadDocument; sourceLang: string; targetLang: string }): Promise<VioReadDocument> {
  const res = await fetch("/api/vioread/translate", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Falha ao traduzir");
  const data = await res.json();
  return data.document as VioReadDocument;
}

export async function requestExplain(input: { fragment: string; context?: string }) {
  const res = await fetch("/api/vioread/explain", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Falha ao explicar");
  return res.json() as Promise<{ explanation: string }>;
}

export async function requestSummary(input: { section: string }) {
  const res = await fetch("/api/vioread/summarize", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Falha ao resumir");
  return res.json() as Promise<{ summary: string }>;
}

export async function requestKeyConcepts(input: { section: string }) {
  const res = await fetch("/api/vioread/key-concepts", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Falha ao extrair conceitos");
  return res.json() as Promise<{ concepts: string[] }>;
}

