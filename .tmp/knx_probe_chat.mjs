const body = { message: "oi", history: [], stream: false, pipelineMode: "lite" };
const started = Date.now();
fetch("http://127.0.0.1:3001/api/chat", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": "token-local"
  },
  body: JSON.stringify(body)
}).then(async (r) => {
  const text = await r.text();
  console.log("STATUS", r.status, "MS", Date.now() - started);
  console.log(text);
}).catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
