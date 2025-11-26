import Fastify from "fastify";

const fastify = Fastify({ logger: true });
const port = Number(process.env.KNEXFLOW_PORT ?? 3840);

fastify.get("/health", async () => ({ status: "ok", service: "knexflow" }));

fastify.listen({ port, host: "0.0.0.0" }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
