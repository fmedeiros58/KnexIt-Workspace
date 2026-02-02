import Fastify from "fastify";

const fastify = Fastify({ logger: false });
const port = Number(process.env.KNEXCHAT_PORT ?? 3850);

fastify.get("/health", async () => ({ status: "ok", service: "knexchat" }));

fastify
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    console.log(`[knexchat] listening on port ${port}`);
  })
  .catch((err) => {
    console.error("[knexchat] failed to start", err);
    process.exit(1);
  });
