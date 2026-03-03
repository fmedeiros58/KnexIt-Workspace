#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
API_KEY="${API_KEY:-${PUBLIC_API_KEY:-}}"

ok_count=0
fail_count=0

ok() {
  ok_count=$((ok_count + 1))
  printf '[OK] %s\n' "$1"
}

fail() {
  fail_count=$((fail_count + 1))
  printf '[FAIL] %s\n' "$1"
}

request_json() {
  local method="$1"
  local url="$2"
  local body="$3"
  local tmp_file
  tmp_file="$(mktemp)"
  local status
  status="$(curl -sS -X "$method" "$url" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "$body" \
    -o "$tmp_file" \
    -w "%{http_code}")"
  local payload
  payload="$(cat "$tmp_file")"
  rm -f "$tmp_file"
  printf '%s\n%s' "$status" "$payload"
}

if [[ -z "$API_KEY" ]]; then
  fail "API_KEY/PUBLIC_API_KEY nao configurada."
  printf '\nResumo smoke RAG: ok=%d fail=%d\n' "$ok_count" "$fail_count"
  exit 1
fi

printf '[INFO] BASE_URL=%s\n' "$BASE_URL"

query_payload='{"question":"Teste de retrieval minimo","topK":3}'
query_response="$(request_json POST "$BASE_URL/query" "$query_payload")"
query_status="$(printf '%s' "$query_response" | head -n 1)"
query_body="$(printf '%s' "$query_response" | tail -n +2)"

if [[ "$query_status" != "200" ]]; then
  fail "POST /query status=$query_status body=$query_body"
else
  if printf '%s' "$query_body" | grep -q '"metadata"[[:space:]]*:' \
    && printf '%s' "$query_body" | grep -q '"retrieval"[[:space:]]*:' \
    && printf '%s' "$query_body" | grep -q '"llm"[[:space:]]*:' \
    && printf '%s' "$query_body" | grep -q '"timingsMs"[[:space:]]*:'; then
    ok "POST /query retornou metadata de auditoria."
  else
    fail "POST /query sem metadata minima esperada. body=$query_body"
  fi
fi

openai_payload='{"model":"mistral-awq","messages":[{"role":"user","content":"Teste openai compat"}],"stream":false}'
openai_response="$(request_json POST "$BASE_URL/v1/chat/completions" "$openai_payload")"
openai_status="$(printf '%s' "$openai_response" | head -n 1)"
openai_body="$(printf '%s' "$openai_response" | tail -n +2)"

if [[ "$openai_status" != "200" ]]; then
  fail "POST /v1/chat/completions status=$openai_status body=$openai_body"
else
  if printf '%s' "$openai_body" | grep -q '"object"[[:space:]]*:[[:space:]]*"chat.completion"' \
    && printf '%s' "$openai_body" | grep -q '"choices"[[:space:]]*:' \
    && printf '%s' "$openai_body" | grep -q '"knex_rag"[[:space:]]*:'; then
    ok "POST /v1/chat/completions retornou formato OpenAI-compatible + metadata RAG."
  else
    fail "POST /v1/chat/completions sem formato esperado. body=$openai_body"
  fi
fi

printf '\nResumo smoke RAG: ok=%d fail=%d\n' "$ok_count" "$fail_count"
if [[ "$fail_count" -gt 0 ]]; then
  exit 1
fi
exit 0

