// app/api/leticia/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs"; // necessário para streaming e (futuro) node-llama-cpp

/** GET: healthcheck */
export async function GET() {
  return new Response("Tudo certo! O endpoint /api/leticia está funcionando.", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** POST: chat com streaming */
export async function POST(req: NextRequest) {
  try {
    const { prompt = "", history = [] } = await req.json().catch(() => ({ prompt: "", history: [] }));

    // --- MODO MOCK (útil para confirmar que o front consome stream) ---
    // Ative temporariamente definindo LETICIA_MOCK=1 no .env.local
    if (process.env.LETICIA_MOCK === "1") {
      const encoder = new TextEncoder();
      const text =
        "Olá! Eu sou a Letícia (modo teste). 🌟\n" +
        "Recebi sua mensagem: \"" + String(prompt).slice(0, 200) + "\".\n" +
        "Se você está vendo este texto aparecer aos poucos, o streaming está OK.\n";
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

    // --- MOTOR LOCAL (node-llama-cpp) ---
    // Descomente este bloco quando já tiver criado lib/leticia/engine.ts
    // e colocado o modelo .gguf em /models
    /*
    const { getLeticiaSession } = await import("@/lib/leticia/engine");
    const session = await getLeticiaSession();

    const iterator = await session.promptStreaming(String(prompt ?? ""), {
      temperature: 0.6,
      topP: 0.9,
      repeatPenalty: 1.05,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(String(value)));
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
    */

    // Se chegou aqui, nem MOCK nem motor local foram usados
    return new Response(JSON.stringify({ message: "LETICIA_MOCK não habilitado e motor local ainda não ligado." }), {
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
