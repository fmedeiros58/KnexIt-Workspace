import Fastify from "fastify";

const fastify = Fastify({ logger: true });
const port = Number(process.env.VIOREAD_PORT ?? 3600);

fastify.get("/health", async () => ({ status: "ok", service: "vioread" }));

fastify.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`[vioread] listening on port ${port}`);
});
