// lib/leticia/_llmAdapter.ts
import path from "path";

// Usamos 'any' para driblar diferenças de tipos entre versões do node-llama-cpp
type Any = any;

const modelPath =
  process.env.LETICIA_MODEL_PATH
    ? path.resolve(process.env.LETICIA_MODEL_PATH)
    : path.resolve(process.cwd(), "models", "mistral-7b-instruct-v0.2.Q4_K_M.gguf");

let llama: Any = null;
let model: Any = null;
let context: Any = null;
let session: Any = null;

// Carrega/retorna uma "sessão" com um método .prompt(text, opts)
export async function getLeticiaSession() {
  if (!llama) {
    // @ts-ignore - a tipagem muda entre versões; usamos dynamic import
    const mod: Any = await import("node-llama-cpp");
    llama = await (mod.getLlama ? mod.getLlama() : new (mod as Any).Llama());
  }
  if (!model) {
    model = await llama.loadModel({ modelPath });
  }
  if (!context) {
    context = await model.createContext({ contextSize: 4096 });
  }
  if (!session) {
    // Algumas versões: new LlamaChatSession({ context, systemPrompt })
    // Outras: new LlamaChatSession(context, { systemPrompt })
    const Chat = (await import("node-llama-cpp") as Any).LlamaChatSession;
    try {
      // @ts-ignore
      session = new Chat({ context, systemPrompt: "Leticia adapter" });
    } catch {
      // @ts-ignore
      session = new Chat(context, { systemPrompt: "Leticia adapter" });
    }
  }

  // Normaliza uma interface mínima com .prompt(text, opts)
  if (typeof session.prompt !== "function") {
    throw new Error("A sessão do LLM não expõe .prompt(). Verifique a versão do node-llama-cpp.");
  }

  return session;
}
