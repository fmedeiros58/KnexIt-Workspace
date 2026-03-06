const body = { message: "qual a capital do brasil?", history: [], stream: false, pipelineMode: "auto" };
const started = Date.now();
fetch("http://127.0.0.1:3001/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": "token-local" },
  body: JSON.stringify(body)
}).then(async (r) => {
  const json = await r.json();
  console.log("STATUS", r.status, "MS", Date.now() - started);
  console.log("MODE", json?.metadata?.llm?.runtimeMode || null);
  console.log("PREVIEW", (json?.reply?.content || "").slice(0, 220));
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
