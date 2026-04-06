import { generationConfig } from "./generation-config";
import { modelConfig } from "./model-config";

export interface VllmClient {
  generate: (
    prompt: string,
    options?: {
      timeoutMs?: number;
    },
  ) => Promise<string>;
}

interface ChatCompletionChoice {
  message?: {
    content?: string;
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

interface CompletionChoice {
  text?: string;
}

interface CompletionResponse {
  choices?: CompletionChoice[];
}

function buildChatCompletionUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function buildCompletionUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/completions")
    ? normalized
    : `${normalized}/completions`;
}

function resolveApiKey() {
  const configured = (
    process.env.AI_SYSTEM_ANM_LLM_API_KEY ||
    process.env.LOCAL_LLM_API_KEY ||
    process.env.VLLM_API_KEY ||
    process.env.LLM_API_KEY ||
    ""
  ).trim();
  return configured || "token-local";
}

function buildHeaders() {
  const apiKey = resolveApiKey();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

async function parseChatCompletionResponse(response: Response): Promise<string> {
  const payload = await response.json() as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content?.trim();
  return content || "";
}

async function parseCompletionResponse(response: Response): Promise<string> {
  const payload = await response.json() as CompletionResponse;
  const content = payload.choices?.[0]?.text?.trim();
  return content || "";
}

export function createVllmClient(): VllmClient {
  const chatEndpoint = buildChatCompletionUrl(modelConfig.baseUrl);
  const completionEndpoint = buildCompletionUrl(modelConfig.baseUrl);

  return {
    async generate(prompt: string, options = {}) {
      const controller = new AbortController();
      const timeoutMs = Math.max(500, options.timeoutMs ?? modelConfig.timeoutMs);
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const headers = buildHeaders();

      try {
        const chatResponse = await fetch(chatEndpoint, {
          method: "POST",
          signal: controller.signal,
          headers,
          body: JSON.stringify({
            model: modelConfig.modelName,
            max_tokens: generationConfig.maxTokens,
            temperature: generationConfig.temperature,
            top_p: generationConfig.topP,
            messages: [
              { role: "user", content: prompt },
            ],
          }),
        });

        if (chatResponse.ok) {
          const chatContent = await parseChatCompletionResponse(chatResponse);
          if (chatContent) return chatContent;
        }

        const completionResponse = await fetch(completionEndpoint, {
          method: "POST",
          signal: controller.signal,
          headers,
          body: JSON.stringify({
            model: modelConfig.modelName,
            max_tokens: generationConfig.maxTokens,
            temperature: generationConfig.temperature,
            top_p: generationConfig.topP,
            prompt,
          }),
        });

        if (completionResponse.ok) {
          const completionContent = await parseCompletionResponse(completionResponse);
          if (completionContent) return completionContent;
        }

        throw new Error("llm_empty_response");
      } catch {
        const compact = prompt.replace(/\s+/g, " ").trim();
        const fallback = compact.length > 220 ? `${compact.slice(0, 219)}...` : compact;
        return `Resposta gerada em fallback local (sem runtime LLM disponivel): ${fallback}`;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export const vllmClientInfo = {
  baseUrl: modelConfig.baseUrl,
  model: modelConfig.modelName,
  maxTokens: generationConfig.maxTokens,
};
