import Fastify from "fastify";

const fastify = Fastify({ logger: true });
const port = Number(process.env.VIOSTUDIO_PORT ?? 3810);

fastify.get("/health", async () => ({ status: "ok", service: "viostudio" }));

fastify.listen({ port, host: "0.0.0.0" }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
