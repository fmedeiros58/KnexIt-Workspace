import Fastify from "fastify";

const fastify = Fastify({ logger: true });
const port = Number(process.env.KNEXCHAT_PORT ?? 3850);

fastify.get("/health", async () => ({ status: "ok", service: "knexchat" }));

fastify.listen({ port, host: "0.0.0.0" }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
