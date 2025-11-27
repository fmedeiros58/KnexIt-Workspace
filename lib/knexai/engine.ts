import path from "path";

type NodeLlamaModule = typeof import("node-llama-cpp");

const modelPath = path.resolve(process.cwd(), "models", "mistral-7b-instruct-v0.2.Q4_K_M.gguf");

let llama: any | null = null;
let model: any | null = null;
let context: any | null = null;

let nodeLlamaModule: NodeLlamaModule | null = null;
let moduleLoadPromise: Promise<boolean> | null = null;

const SYSTEM_PROMPT =
  "Você é a L.E.T.I.C.I.A., IA nativa do ecossistema KnexIT. " +
  "Fale em português do Brasil, seja clara, respeitosa e objetiva. " +
  "Seja consistente com o contexto quando fornecido.";

async function loadLocalLlama(): Promise<boolean> {
  if (nodeLlamaModule) return true;
  if (moduleLoadPromise) return moduleLoadPromise;
  if (process.env.USE_LOCAL_LLAMA !== "1") {
    return false;
  }
  moduleLoadPromise = import("node-llama-cpp")
    .then((mod) => {
      nodeLlamaModule = mod;
      return true;
    })
    .catch((error) => {
      console.warn("node-llama-cpp could not be loaded:", error);
      nodeLlamaModule = null;
      return false;
    })
    .finally(() => {
      moduleLoadPromise = null;
    });
  return moduleLoadPromise;
}

export async function getLeticiaSession() {
  const hasLocal = await loadLocalLlama();
  if (!hasLocal || !nodeLlamaModule) {
    throw new Error(
      "Local Llama engine is not enabled. Set USE_LOCAL_LLAMA=1 and ensure node-llama-cpp is installed."
    );
  }
  const { Llama, LlamaModel, LlamaContext, LlamaChatSession } = nodeLlamaModule;
  if (!llama) {
    llama = new (Llama as any)({ gpu: "auto" });
  }
  if (!model) {
    model = await llama!.loadModel({ modelPath });
  }
  if (!context) {
    context = await model!.createContext({ contextSize: 4096 } as any);
  }
  const session = new (LlamaChatSession as any)({
    context: context as any,
    systemPrompt: SYSTEM_PROMPT,
  } as any);
  return session;
}
