import Fastify from "fastify";

const fastify = Fastify({ logger: true });
const port = Number(process.env.VIOANALYTICS_PORT ?? 3820);

fastify.get("/health", async () => ({ status: "ok", service: "vioanalytics" }));

fastify.listen({ port, host: "0.0.0.0" }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
