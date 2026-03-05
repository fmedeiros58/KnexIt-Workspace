const headers = { "content-type": "application/json", "x-api-key": "token-local" };
async function run() {
  await fetch("http://127.0.0.1:3001/api/chat/router-metrics", { method: "POST", headers, body: JSON.stringify({ reset: true }) });
  const started = Date.now();
  const r = await fetch("http://127.0.0.1:3001/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ message: "oi", history: [], stream: false, pipelineMode: "auto" }),
  });
  const text = await r.text();
  console.log("CHAT_STATUS", r.status, "MS", Date.now() - started);
  console.log(text.slice(0, 280));
  const m = await fetch("http://127.0.0.1:3001/api/chat/router-metrics", { headers: { "x-api-key": "token-local" } });
  console.log("METRICS_STATUS", m.status);
  console.log(await m.text());
}
run().catch((e) => { console.error(e); process.exit(1); });
