import { generationConfig } from "./generation-config";
import { modelConfig } from "./model-config";

export interface VllmClient {
  generate: (prompt: string) => Promise<string>;
}

interface ChatCompletionChoice {
  message?: {
    content?: string;
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

function buildChatCompletionUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

export function createVllmClient(): VllmClient {
  const endpoint = buildChatCompletionUrl(modelConfig.baseUrl);

  return {
    async generate(prompt: string) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(500, modelConfig.timeoutMs));

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
          },
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

        if (!response.ok) {
          throw new Error(`llm_http_${response.status}`);
        }

        const payload = await response.json() as ChatCompletionResponse;
        const content = payload.choices?.[0]?.message?.content?.trim();
        if (content) return content;
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
