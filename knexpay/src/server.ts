import Fastify from "fastify";

const fastify = Fastify({ logger: true });
const port = Number(process.env.KNEXPAY_PORT ?? 3870);

fastify.get("/health", async () => ({ status: "ok", service: "knexpay" }));

fastify.listen({ port, host: "0.0.0.0" }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
