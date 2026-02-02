import Fastify from "fastify";

const fastify = Fastify({ logger: false });
const port = Number(process.env.SUPADRIVE_PORT ?? 3300);

fastify.get("/health", async () => ({ status: "ok", service: "supadrive" }));

fastify
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    console.log(`[supadrive] listening on port ${port}`);
  })
  .catch((err) => {
    console.error("[supadrive] failed to start", err);
    process.exit(1);
  });
