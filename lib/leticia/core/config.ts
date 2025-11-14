// lib/leticia/core/config.ts

// ---- Config "funcional" da Letícia (o que seu código já usa) ----
export const LETICIA = {
  system:
    "Você é a L.E.T.I.C.I.A., IA do UPgrade. Fale em pt-BR, objetiva, didática e segura.",
  maxContext: 4096,
  myelin: { ttlMs: 1000 * 60 * 60 * 24, max: 500, decay: 0.997 },

  // Superposição (amostras com diferentes temperaturas)
  superposition: {
    beams: [
      { id: "cold",    temperature: 0.2 },
      { id: "medium",  temperature: 0.6 },
      { id: "creative",temperature: 0.9 },
    ],
    maxTokens: 512,
  },

  // Pesos do score de fusão
  scoring: { faithfulnessW: 0.5, relevanceW: 0.3, styleW: 0.2 },

  // Nódulos / roteamento
  nodes: { enabled: true, topK: 2, weightRouter: 0.35 },
} as const;

// ---- (Opcional) Config de ambiente centralizada ----
// Use se quiser parar de ler process.env espalhado.
// Mantive enxuto; pode expandir depois (LLM_URL, modelos etc).
export const cfgEnv = {
  env: process.env.NODE_ENV ?? "development",
};
