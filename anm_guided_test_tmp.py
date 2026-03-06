import json
import time
import urllib.request

URI = "http://127.0.0.1:8113/chat"

payloads = [
    {"message": "Explique neuroplasticidade de forma objetiva em 2 paragrafos curtos, com foco em aprendizado."},
    {"message": "Continue a explicacao conectando com aplicacoes clinicas e finalize com uma sintese de 1 frase."},
]

responses = []
for idx, payload in enumerate(payloads, start=1):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        URI,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=240) as resp:
        parsed = json.loads(resp.read().decode("utf-8"))
    responses.append(parsed)
    with open(f"/mnt/c/knexit-workspace/knexit-workspace/guided-call{idx}.json", "w", encoding="utf-8") as fh:
        json.dump(parsed, fh, ensure_ascii=False, indent=2)
    if idx == 1:
        time.sleep(1.0)

for idx, row in enumerate(responses, start=1):
    answer = str(row.get("answer", ""))
    words = len([w for w in answer.split() if w.strip()])
    orch = (((row.get("engine") or {}).get("orchestration") or {}))
    print(f"call{idx}_trace={row.get('trace_id')}")
    print(f"call{idx}_session={orch.get('session_id')}")
    print(f"call{idx}_mode={orch.get('response_mode')}")
    print(f"call{idx}_cycles={orch.get('cycle_count')}")
    print(f"call{idx}_stop={orch.get('stop_reason')}")
    print(f"call{idx}_len={len(answer)} words={words}")
