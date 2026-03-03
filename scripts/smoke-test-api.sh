#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
API_KEY="${API_KEY:-${PUBLIC_API_KEY:-}}"
OPENAI_REQUIRED="${OPENAI_REQUIRED:-1}"

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

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local auth_mode="${4:-none}"
  local tmp_file
  tmp_file="$(mktemp)"

  local -a args
  args=(-sS -X "$method" "$url" -H "Content-Type: application/json" -o "$tmp_file" -w "%{http_code}")
  if [[ "$auth_mode" == "api_key" && -n "$API_KEY" ]]; then
    args+=(-H "x-api-key: $API_KEY")
  fi
  if [[ -n "$body" ]]; then
    args+=(-d "$body")
  fi

  local status
  status="$(curl "${args[@]}")"
  local payload
  payload="$(cat "$tmp_file")"
  rm -f "$tmp_file"

  printf '%s\n%s' "$status" "$payload"
}

assert_status_and_contains() {
  local label="$1"
  local status="$2"
  local body="$3"
  local expected_status="$4"
  local expected_pattern="$5"

  if [[ "$status" != "$expected_status" ]]; then
    fail "$label retornou status $status (esperado $expected_status). Body: $(trim "$body")"
    return
  fi
  if ! printf '%s' "$body" | grep -q "$expected_pattern"; then
    fail "$label sem padrao esperado '$expected_pattern'. Body: $(trim "$body")"
    return
  fi
  ok "$label status=$status e payload valido."
}

printf '[INFO] BASE_URL=%s\n' "$BASE_URL"

health_response="$(request GET "$BASE_URL/health")"
health_status="$(printf '%s' "$health_response" | head -n 1)"
health_body="$(printf '%s' "$health_response" | tail -n +2)"
assert_status_and_contains "GET /health" "$health_status" "$health_body" "200" '"ok"[[:space:]]*:[[:space:]]*true'

ready_response="$(request GET "$BASE_URL/ready")"
ready_status="$(printf '%s' "$ready_response" | head -n 1)"
ready_body="$(printf '%s' "$ready_response" | tail -n +2)"
assert_status_and_contains "GET /ready" "$ready_status" "$ready_body" "200" '"status"[[:space:]]*:[[:space:]]*"ready"'

if [[ -z "$API_KEY" ]]; then
  fail "API_KEY/PUBLIC_API_KEY nao configurada para testar rotas protegidas."
else
  query_payload='{"question":"Smoke test da API publica","topK":2}'
  query_response="$(request POST "$BASE_URL/query" "$query_payload" "api_key")"
  query_status="$(printf '%s' "$query_response" | head -n 1)"
  query_body="$(printf '%s' "$query_response" | tail -n +2)"
  assert_status_and_contains "POST /query" "$query_status" "$query_body" "200" '"answer"[[:space:]]*:'

  chat_payload='{"message":"Teste rapido de chat","topK":2}'
  chat_response="$(request POST "$BASE_URL/chat" "$chat_payload" "api_key")"
  chat_status="$(printf '%s' "$chat_response" | head -n 1)"
  chat_body="$(printf '%s' "$chat_response" | tail -n +2)"
  assert_status_and_contains "POST /chat" "$chat_status" "$chat_body" "200" '"reply"[[:space:]]*:'

  if [[ "$OPENAI_REQUIRED" == "1" ]]; then
    openai_payload='{"model":"mistral-awq","messages":[{"role":"user","content":"Smoke test openai"}],"stream":false}'
    openai_response="$(request POST "$BASE_URL/v1/chat/completions" "$openai_payload" "api_key")"
    openai_status="$(printf '%s' "$openai_response" | head -n 1)"
    openai_body="$(printf '%s' "$openai_response" | tail -n +2)"
    assert_status_and_contains "POST /v1/chat/completions" "$openai_status" "$openai_body" "200" '"object"[[:space:]]*:[[:space:]]*"chat.completion"'
  fi
fi

printf '\nResumo smoke API: ok=%d fail=%d\n' "$ok_count" "$fail_count"
if [[ "$fail_count" -gt 0 ]]; then
  exit 1
fi
exit 0

