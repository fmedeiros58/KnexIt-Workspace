const Koa = require("koa");

const app = new Koa();
const port = process.env.VIOHUB_PORT || 3400;

app.use(async (ctx) => {
  if (ctx.path === "/health") {
    ctx.body = { status: "ok", service: "viohub" };
    return;
  }
  ctx.body = { message: "Viohub service" };
});

app.listen(port, () => {
  console.log(`[viohub] listening on port ${port}`);
});
