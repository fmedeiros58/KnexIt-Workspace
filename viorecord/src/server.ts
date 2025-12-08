import Fastify from "fastify";

const fastify = Fastify({ logger: true });
const port = Number(process.env.VIORECORD_PORT ?? 3800);

fastify.get("/health", async () => ({ status: "ok", service: "viorecord" }));

fastify.listen({ port, host: "0.0.0.0" }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
