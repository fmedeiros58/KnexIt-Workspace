import Fastify from "fastify";

const fastify = Fastify({ logger: true });
const port = Number(process.env.KNEXSEARCH_PORT ?? 3860);

fastify.get("/health", async () => ({ status: "ok", service: "knexsearch" }));

fastify.listen({ port, host: "0.0.0.0" }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
