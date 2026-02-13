import Fastify from "fastify";

const fastify = Fastify({ logger: false });
const parsedPort = Number(process.env.PORT ?? process.env.KNEXCHAT_PORT ?? 3850);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3850;
const registeredRoutes = new Set<string>();

fastify.addHook("onRoute", (routeOptions) => {
  const methods = Array.isArray(routeOptions.method)
    ? routeOptions.method
    : [routeOptions.method];

  for (const method of methods) {
    registeredRoutes.add(`${String(method).toUpperCase()} ${routeOptions.url}`);
  }
});

fastify.get("/", async () => ({
  ok: true,
  service: "knexchat-web",
  env: process.env.NODE_ENV ?? "development",
}));

fastify.get("/health", async () => ({
  ok: true,
  uptime: Math.floor(process.uptime()),
  timestamp: new Date().toISOString(),
}));

fastify.get("/routes", async () => ({
  ok: true,
  routes:
    registeredRoutes.size > 0
      ? Array.from(registeredRoutes).sort()
      : ["GET /", "GET /health", "GET /routes"],
}));

fastify
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    console.log(`[knexchat] listening on port ${port}`);
    console.log("[knexchat] routes: GET /, GET /health, GET /routes");
  })
  .catch((err) => {
    console.error("[knexchat] failed to start", err);
    process.exit(1);
  });
