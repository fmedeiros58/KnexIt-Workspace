// app/api/leticia/route.ts
export const runtime = "nodejs";

// ----- tipos mínimos -----
type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };

// ----- envs -----
const PROVIDER = (process.env.NEXT_PUBLIC_LETICIA_PROVIDER || "vllm").toLowerCase();

// vLLM
const VLLM_BASE_URL = (process.env.VLLM_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const VLLM_MODEL = process.env.VLLM_MODEL || "TinyLlama/TinyLlama-1.1B-Chat-v1.0";
const VLLM_API_KEY = process.env.VLLM_API_KEY || process.env.OPENAI_API_KEY || ""; // OpenAI-compatible auth

// Ollama (opcional; só usado se você trocar PROVIDER para "ollama")
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral-local";

// ----- helpers -----
function asMessages(input: unknown): Msg[] | null {
  if (!Array.isArray(input)) return null;
  return input
    .map((m: any): Msg | null => {
      const role = (m?.role ?? "user") as Role;
      const content = String(m?.content ?? "");
      if (!content) return null;
      return {
        role:
          role === "user" || role === "assistant" || role === "system" ? role : "user",
        content,
      };
    })
    .filter(Boolean) as Msg[];
}
function isChatModel(name: string) {
  return /chat/i.test(name);
}
function buildVllmUrl(model: string) {
  const ep = isChatModel(model) ? "/v1/chat/completions" : "/v1/completions";
  return `${VLLM_BASE_URL}${ep}`;
}

function vllmHeaders(extra?: HeadersInit): HeadersInit {
  const base: Record<string, string> = {};
  if (VLLM_API_KEY) base["Authorization"] = `Bearer ${VLLM_API_KEY}`;
  return { ...base, ...(extra as any) };
}

function abortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  // @ts-ignore - unref não existe no browser
  (setTimeout(() => controller.abort(), timeoutMs) as any)?.unref?.();
  return controller.signal;
}

// --------- GET ---------
export async function GET() {
  return new Response("OK: /api/leticia está no ar.", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// --------- POST ---------
export async function POST(req: Request) {
  try {
    // body aceita { prompt, history?, messages?, gen?, stream?, mode? }
    const body = await req.json().catch(() => ({} as any));

    const mode: "plan" | "answer" =
      body?.mode === "plan" ? "plan" : "answer";

    const incomingMessages = asMessages(body.messages);
    const history = asMessages(body.history) || [];

    const promptRaw: string | undefined =
      typeof body.prompt === "string" ? body.prompt : undefined;

    const promptFromMessages =
      !promptRaw && incomingMessages
        ? incomingMessages.map((m) => `${m.role}: ${m.content}`).join("\n") + "\nassistant:"
        : undefined;

    const prompt = (promptRaw ?? promptFromMessages ?? "").trim();

    if (prompt.toLowerCase() === "diga oi") {
      return new Response("Olá, como posso ajudar?", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // --------- parâmetros de geração ----------
    const gen = body?.gen ?? {};
    const maxTokens =
      Number.isFinite(gen?.max_tokens) ? Number(gen.max_tokens)
      : Number.isFinite(body?.max_tokens) ? Number(body.max_tokens)
      : (mode === "plan" ? 160 : 900);

    const temperature =
      Number.isFinite(gen?.temperature) ? Number(gen.temperature)
      : Number.isFinite(body?.temperature) ? Number(body.temperature)
      : (mode === "plan" ? 0.2 : 0.7);

    const top_p =
      Number.isFinite(gen?.top_p) ? Number(gen.top_p)
      : Number.isFinite(body?.top_p) ? Number(body.top_p)
      : (mode === "plan" ? 0.9 : 0.9);

    const presence_penalty =
      Number.isFinite(gen?.presence_penalty) ? Number(gen.presence_penalty)
      : Number.isFinite(body?.presence_penalty) ? Number(body.frequency_penalty)
      : undefined;

    const frequency_penalty =
      Number.isFinite(gen?.frequency_penalty) ? Number(gen.frequency_penalty)
      : Number.isFinite(body?.frequency_penalty) ? Number(body.frequency_penalty)
      : undefined;

    // habilita streaming por padrão para respostas principais
    const wantStream: boolean =
      typeof body?.stream === "boolean" ? body.stream : mode === "answer";

    if (PROVIDER === "vllm") {
      const model = String(body?.model || VLLM_MODEL);
      const url = buildVllmUrl(model);

      // Monta mensagens
      const baseMessages =
        incomingMessages && incomingMessages.length
          ? incomingMessages
          : [...history, { role: "user", content: prompt || "Olá!" }];

      // Para o "modo plano/considerações": instrução curta e segura (sem cadeia de pensamento).
      const planPrefix: Msg[] =
        mode === "plan"
          ? [{
              role: "system",
              content:
                "Você é um assistente que prepara um checklist objetivo do que será considerado na resposta. Liste 5–8 bullets curtos (2–5 palavras), sem explicar como você chegou neles, sem raciocínio passo-a-passo. Apenas os itens, um por linha.",
            }]
          : [];

      const messages = planPrefix.length ? [...planPrefix, ...baseMessages] : baseMessages;

      const baseGen = {
        max_tokens: maxTokens,
        temperature,
        top_p,
        ...(presence_penalty !== undefined ? { presence_penalty } : {}),
        ...(frequency_penalty !== undefined ? { frequency_penalty } : {}),
      };

      // ping (fail-fast)
      const ping = await fetch(`${VLLM_BASE_URL}/v1/models`, { headers: vllmHeaders(), signal: abortSignal(7000), cache: "no-store" }).catch((e) => e as Error);
      if (!(ping as Response)?.ok) {
        const detail =
          ping instanceof Response ? await ping.text().catch(() => "") : String(ping);
        return new Response(`❌ vLLM indisponível: ${detail}`, {
          status: 502,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      // STREAM: sim, usamos stream=true no upstream e transformamos para texto puro.
      if (wantStream && isChatModel(model)) {
        const upstream = await fetch(url, {
          method: "POST",
          headers: vllmHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            model,
            messages,
            stream: true,
            ...baseGen,
          }),
          cache: "no-store",
          signal: abortSignal(30000),
        }).catch((e) => e as Error);

        if (!(upstream as Response)?.ok) {
          const status = upstream instanceof Response ? upstream.status : 500;
          const raw = upstream instanceof Response ? await upstream.text().catch(() => "") : String(upstream);
          return new Response(`❌ Erro vLLM (${status}): ${raw || "sem detalhes"}`, {
            status: 502,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }

        const reader = (upstream as Response).body!.getReader();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const stream = new ReadableStream({
          async start(controller) {
            let buf = "";
            try {
              for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });

                // OpenAI-style SSE: linhas "data: {...}"
                const lines = buf.split("\n");
                buf = lines.pop() || "";
                for (const line of lines) {
                  const s = line.trim();
                  if (!s || s === "data: [DONE]") continue;
                  if (!s.startsWith("data:")) continue;
                  try {
                    const json = JSON.parse(s.slice(5).trim());
                    const delta =
                      json?.choices?.[0]?.delta?.content ??
                      json?.choices?.[0]?.text ??
                      "";
                    if (delta) controller.enqueue(encoder.encode(delta));
                  } catch {
                    // ignora pedaços inválidos
                  }
                }
              }
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      // Sem stream (ou modelo /completions)
      const payload = isChatModel(model)
        ? { model, messages, ...baseGen, stream: false }
        : { model, prompt: prompt || "Olá!", ...baseGen };

      const r = await fetch(url, {
        method: "POST",
        headers: vllmHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: abortSignal(30000),
      }).catch((e) => e as Error);

      if (!(r as Response)?.ok) {
        const status = r instanceof Response ? r.status : 500;
        const raw = r instanceof Response ? await r.text().catch(() => "") : String(r);
        return new Response(`❌ Erro vLLM (${status}): ${raw || "sem detalhes"}`, {
          status: 502,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      const data = await (r as Response).json().catch(async () => {
        const t = await (r as Response).text().catch(() => "");
        return t ? { raw: t } : {};
      });

      const text =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        (typeof data?.raw === "string" ? data.raw : JSON.stringify(data));

      return new Response(String(text ?? ""), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // ---- OLLAMA (apenas se trocar o PROVIDER p/ "ollama") ----
    if (PROVIDER === "ollama") {
      const baseMessages =
        incomingMessages && incomingMessages.length
          ? incomingMessages
          : [...history, { role: "user", content: prompt || "Olá!" }];

      // modo “plan”: pede bullets curtos
      const messages =
        mode === "plan"
          ? [
              {
                role: "system",
                content:
                  "Checklist objetivo do que será considerado. 5–8 bullets curtos, 2–5 palavras cada. Sem raciocínio passo-a-passo.",
              },
              ...baseMessages,
            ]
          : baseMessages;

      const ping = await fetch(`${OLLAMA_URL}/api/tags`).catch((e) => e as Error);
      if (!(ping as Response)?.ok) {
        const detail =
          ping instanceof Response ? await ping.text().catch(() => "") : String(ping);
        return new Response(`❌ Ollama indisponível: ${detail}`, {
          status: 502,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      const r = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: String(body?.model || OLLAMA_MODEL),
          messages,
          options: { temperature, top_p, num_predict: maxTokens },
          stream: false, // (simplificado)
        }),
        cache: "no-store",
      }).catch((e) => e as Error);

      if (!(r as Response)?.ok) {
        const status = r instanceof Response ? r.status : 500;
        const raw = r instanceof Response ? await r.text().catch(() => "") : String(r);
        return new Response(`❌ Erro do Ollama (${status}): ${raw || "sem detalhes"}`, {
          status: 502,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      const raw = await (r as Response).text();
      try {
        const data = JSON.parse(raw);
        const content = data?.message?.content ?? "";
        return new Response(content, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      } catch {
        return new Response(raw, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    }

    return new Response(`❌ Provider desconhecido: ${PROVIDER}`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "Requisição abortada (dev/hot reload)."
        : e?.message || "Falha no endpoint.";
    console.error("LETICIA POST ERROR:", e);
    return new Response(`❌ ${msg}`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

