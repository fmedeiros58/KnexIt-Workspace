const body = { message: "oi", history: [], stream: false, pipelineMode: "auto" };
const started = Date.now();
fetch("http://127.0.0.1:3001/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": "token-local" },
  body: JSON.stringify(body)
}).then(async (r) => {
  const json = await r.json();
  console.log("STATUS", r.status, "MS", Date.now() - started);
  console.log("META_PROGRESS", json?.meta?.progress || null);
  console.log("META_LLM_MODE", json?.metadata?.llm?.runtimeMode || null);
  console.log("REPLY_CHARS", (json?.reply?.content || "").length);
  console.log("PREVIEW", (json?.reply?.content || "").slice(0, 220));
}).catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
