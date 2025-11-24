// app/api/leticia/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs"; // necessÃ¡rio para streaming e (futuro) node-llama-cpp

/** GET: healthcheck */
export async function GET() {
  return new Response("Tudo certo! O endpoint /api/leticia estÃ¡ funcionando.", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** POST: chat com streaming */
export async function POST(req: NextRequest) {
  try {
    const { prompt = "", history = [] } = await req.json().catch(() => ({ prompt: "", history: [] }));

    // --- MODO MOCK (Ãºtil para confirmar que o front consome stream) ---
    // Ative temporariamente definindo LETICIA_MOCK=1 no .env.local (ativo por padrÃ£o em desenvolvimento)
    const useMock = process.env.LETICIA_MOCK === "1" || (process.env.LETICIA_MOCK !== "0" && process.env.NODE_ENV !== "production");
    if (useMock) {
      const encoder = new TextEncoder();
      const text =
        "OlÃ¡! Eu sou a LetÃ­cia (modo teste). ðŸŒŸ\n" +
        "Recebi sua mensagem: \"" + String(prompt).slice(0, 200) + "\".\n" +
        "Se vocÃª estÃ¡ vendo este texto aparecer aos poucos, o streaming estÃ¡ OK.\n";
      let i = 0;

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const timer = setInterval(() => {
            if (i >= text.length) {
              clearInterval(timer);
              controller.close();
            } else {
              controller.enqueue(encoder.encode(text[i]));
              i++;
            }
          }, 8);
        },
      });

      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // --- MOTOR LOCAL: vLLM via API OpenAI-compatible ---
    const baseUrl = process.env.VLLM_BASE_URL || "http://127.0.0.1:8000/v1";
    const apiKey = process.env.VLLM_API_KEY || "EMPTY"; // vLLM aceita qualquer token por padrÃ£o
    const model = process.env.VLLM_MODEL || "meta-llama/Meta-Llama-3-8B-Instruct";

    const sys = "VocÃª Ã© a L.E.T.I.C.I.A., IA nativa do ecossistema KnexIT. Fale PT-BR, seja clara, respeitosa e objetiva.";
    const messages = [
      { role: "system", content: sys },
      { role: "user", content: String(prompt ?? "") }
    ];

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.6, top_p: 0.9, stream: true }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      return new Response(JSON.stringify({ message: `vLLM error ${res.status}: ${text}` }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const reader = res.body!.getReader();
        let buf = "";
        function feed() {
          reader.read().then(({ value, done }) => {
            if (done) { controller.close(); return; }
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split(/\r?\n/);
            buf = lines.pop() || "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") { controller.close(); return; }
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.text ?? "";
                if (delta) controller.enqueue(encoder.encode(String(delta)));
              } catch {}
            }
            feed();
          }).catch(() => controller.close());
        }
        feed();
      }
    });

    return new Response(stream, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });


    // Se chegou aqui, nem MOCK nem motor foram usados
    return new Response(JSON.stringify({ message: "LETICIA_MOCK nÃ£o habilitado e motor nÃ£o configurado." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("LETICIA_POST_ERROR", err);
    return new Response(JSON.stringify({ message: err?.message ?? "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

