import Fastify from "fastify";

const fastify = Fastify({ logger: true });
const port = Number(process.env.VIOLIVE_PORT ?? 3400);

fastify.get("/health", async () => ({ status: "ok", service: "violive" }));

fastify.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`[violive] listening on port ${port}`);
});
