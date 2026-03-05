const body = { message: "oi", history: [], stream: false, pipelineMode: "auto" };
fetch("http://127.0.0.1:3001/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": "token-local" },
  body: JSON.stringify(body)
}).then(async (r) => {
  const json = await r.json();
  console.log("STATUS", r.status);
  console.log("METADATA_KEYS", Object.keys(json?.metadata || {}));
  console.log("HAS_LLM", Boolean(json?.metadata?.llm));
  console.log("METADATA", JSON.stringify(json?.metadata || null).slice(0, 600));
}).catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
