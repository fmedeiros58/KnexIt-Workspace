import Fastify from "fastify";

const fastify = Fastify({ logger: true });
const port = Number(process.env.KNEKXDOCS_PORT ?? 3830);

fastify.get("/health", async () => ({ status: "ok", service: "knexdocs" }));

fastify.listen({ port, host: "0.0.0.0" }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
