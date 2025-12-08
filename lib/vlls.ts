// lib/vllm.ts
export function isChatModel(model: string) {
  return /chat/i.test(model);
}
export function buildVllmUrl(baseUrl: string, model: string) {
  const root = baseUrl.replace(/\/$/, "");
  const endpoint = isChatModel(model) ? "/v1/chat/completions" : "/v1/completions";
  return `${root}${endpoint}`;
}
