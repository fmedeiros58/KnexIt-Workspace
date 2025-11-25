import path from "path";
import { Llama, LlamaModel, LlamaContext, LlamaChatSession } from "node-llama-cpp";

// Caminho do modelo local (.gguf)
const modelPath = path.resolve(process.cwd(), "models", "mistral-7b-instruct-v0.2.Q4_K_M.gguf");

// Singletons para evitar re-carregar a cada request
let llama: Llama | null = null;
let model: LlamaModel | null = null;
let context: LlamaContext | null = null;

// Prompt de sistema da Leticia
const SYSTEM_PROMPT =
  "VocÃª Ã© a L.E.T.I.C.I.A., IA nativa do ecossistema KnexIT. " +
  "Fale em portuguÃªs do Brasil, seja clara, respeitosa e objetiva. " +
  "Seja consistente com o contexto quando fornecido.";

export async function getLeticiaSession() {
  if (!llama) {
    // gpu: "auto" tenta usar GPU se disponÃ­vel; mude para "cpu" se preferir
    // constructor may be private in the installed types; cast to any to call at runtime if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    llama = new (Llama as any)({ gpu: "auto" });
  }
  if (!model) {
    model = await llama!.loadModel({ modelPath });
  }
  if (!context) {
    context = await model!.createContext({ contextSize: 4096 } as any);
  }
  // LlamaChatSession options typing may differ; cast to any for now
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = new (LlamaChatSession as any)({
    context: context as any,
    systemPrompt: SYSTEM_PROMPT,
  } as any);
  return session;
}

