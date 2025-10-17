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
  "Você é a L.E.T.I.C.I.A., IA nativa do projeto UPgrade. " +
  "Fale em português do Brasil, seja clara, respeitosa e objetiva. " +
  "Seja consistente com o contexto quando fornecido.";

export async function getLeticiaSession() {
  if (!llama) {
    // gpu: "auto" tenta usar GPU se disponível; mude para "cpu" se preferir
    llama = new Llama({ gpu: "auto" });
  }
  if (!model) {
    model = await llama.loadModel({ modelPath });
  }
  if (!context) {
    context = await model.createContext({ contextSize: 4096 });
  }
  const session = new LlamaChatSession({
    context,
    systemPrompt: SYSTEM_PROMPT,
  });
  return session;
}
