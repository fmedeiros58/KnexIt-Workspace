import Fastify from "fastify";

const fastify = Fastify({ logger: true });
const port = Number(process.env.KNEXAI_PORT ?? 3700);

fastify.get("/health", async () => ({ status: "ok", service: "knexai" }));

fastify.post("/chat", async (req) => {
  const body = (req.body as any) ?? {};
  return {
    reply: `KnexAI stub recebeu: ${String(body.prompt ?? "")}`,
    mode: process.env.LETICIA_MOCK === "0" ? "model" : "mock",
  };
});

fastify.listen({ port, host: "0.0.0.0" }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
