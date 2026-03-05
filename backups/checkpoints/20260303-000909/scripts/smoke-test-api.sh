#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-}"
API_KEY="${API_KEY:-${PUBLIC_API_KEY:-}}"
OPENAI_REQUIRED="${OPENAI_REQUIRED:-1}"
ENV_FILE="${ENV_FILE:-.env.local}"

ok_count=0
fail_count=0

CURL_BIN="${CURL_BIN:-}"

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

is_wsl() {
  [[ -f /proc/sys/kernel/osrelease ]] && grep -qi "microsoft" /proc/sys/kernel/osrelease
}

resolve_curl_bin() {
  if [[ -n "$CURL_BIN" ]]; then
    printf '%s' "$CURL_BIN"
    return 0
  fi

  if is_wsl && command -v curl.exe >/dev/null 2>&1; then
    printf '%s' "curl.exe"
    return 0
  fi

  printf '%s' "curl"
}

curl_http() {
  "$CURL_BIN" "$@"
}

discard_path() {
  if [[ "$CURL_BIN" == "curl.exe" ]]; then
    printf '%s' "NUL"
    return 0
  fi
  printf '%s' "/dev/null"
}

probe_status() {
  local url="$1"
  local status
  status="$(curl_http -sS -o "$(discard_path)" -w "%{http_code}" "$url" 2>/dev/null || true)"
  if [[ -z "$status" ]]; then
    status="000"
  fi
  printf '%s' "$status"
}

resolve_base_url() {
  if [[ -n "$BASE_URL" ]]; then
    printf '%s' "$BASE_URL"
    return 0
  fi

  local -a candidates
  candidates=(
    "http://localhost:3000"
    "http://127.0.0.1:3000"
    "http://host.docker.internal:3000"
  )

  if [[ -f /etc/resolv.conf ]]; then
    local wsl_host
    wsl_host="$(awk '/^nameserver[[:space:]]+/ { print $2; exit }' /etc/resolv.conf 2>/dev/null || true)"
    if [[ -n "$wsl_host" ]]; then
      candidates+=("http://$wsl_host:3000")
    fi
  fi

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ "$(probe_status "$candidate/health")" == "200" ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  printf '%s' "http://localhost:3000"
}

read_env_value() {
  local key="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    return 0
  fi
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 0
  fi
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line#\"}"
  line="${line%\"}"
  printf '%s' "$line"
}

first_csv_item() {
  local value="$1"
  value="${value%%,*}"
  value="$(trim "$value")"
  printf '%s' "$value"
}

if [[ -z "$API_KEY" ]]; then
  API_KEY="$(read_env_value PUBLIC_API_KEY)"
fi
if [[ -z "$API_KEY" ]]; then
  API_KEY="$(first_csv_item "${PUBLIC_API_KEYS:-}")"
fi
if [[ -z "$API_KEY" ]]; then
  API_KEY="$(first_csv_item "$(read_env_value PUBLIC_API_KEYS)")"
fi

CURL_BIN="$(resolve_curl_bin)"
BASE_URL="$(resolve_base_url)"

request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local auth_mode="${4:-none}"

  local -a args
  args=(-sS -X "$method" "$url" -H "Content-Type: application/json")
  if [[ "$auth_mode" == "api_key" && -n "$API_KEY" ]]; then
    args+=(-H "x-api-key: $API_KEY")
  fi
  if [[ -n "$body" ]]; then
    args+=(-d "$body")
  fi

  local marker
  marker="__SMOKE_STATUS__"
  local raw
  raw="$(curl_http "${args[@]}" -w "$marker%{http_code}" 2>/dev/null || true)"

  local status
  local payload
  if [[ "$raw" == *"$marker"* ]]; then
    status="${raw##*${marker}}"
    payload="${raw%${marker}*}"
  else
    status="000"
    payload="$raw"
  fi

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
printf '[INFO] CURL_BIN=%s\n' "$CURL_BIN"
if [[ -n "$API_KEY" ]]; then
  printf '[INFO] API_KEY=definida\n'
else
  printf '[WARN] API_KEY nao definida; testes de rotas protegidas tentarao sem auth.\n'
fi

health_response="$(request GET "$BASE_URL/health")"
health_status="$(printf '%s' "$health_response" | head -n 1)"
health_body="$(printf '%s' "$health_response" | tail -n +2)"
assert_status_and_contains "GET /health" "$health_status" "$health_body" "200" '"ok"[[:space:]]*:[[:space:]]*true'

ready_response="$(request GET "$BASE_URL/ready")"
ready_status="$(printf '%s' "$ready_response" | head -n 1)"
ready_body="$(printf '%s' "$ready_response" | tail -n +2)"
assert_status_and_contains "GET /ready" "$ready_status" "$ready_body" "200" '"status"[[:space:]]*:[[:space:]]*"ready"'

auth_mode="none"
if [[ -n "$API_KEY" ]]; then
  auth_mode="api_key"
fi

query_payload='{"question":"Smoke test da API publica","topK":2}'
query_response="$(request POST "$BASE_URL/query" "$query_payload" "$auth_mode")"
query_status="$(printf '%s' "$query_response" | head -n 1)"
query_body="$(printf '%s' "$query_response" | tail -n +2)"
if [[ "$query_status" == "401" && -z "$API_KEY" ]]; then
  fail "POST /query retornou 401 sem API key; defina PUBLIC_API_KEY (ou API_KEY) para smoke."
else
  assert_status_and_contains "POST /query" "$query_status" "$query_body" "200" '"answer"[[:space:]]*:'
fi

chat_payload='{"message":"Teste rapido de chat","topK":2}'
chat_response="$(request POST "$BASE_URL/chat" "$chat_payload" "$auth_mode")"
chat_status="$(printf '%s' "$chat_response" | head -n 1)"
chat_body="$(printf '%s' "$chat_response" | tail -n +2)"
if [[ "$chat_status" == "401" && -z "$API_KEY" ]]; then
  fail "POST /chat retornou 401 sem API key; defina PUBLIC_API_KEY (ou API_KEY) para smoke."
else
  assert_status_and_contains "POST /chat" "$chat_status" "$chat_body" "200" '"reply"[[:space:]]*:'
fi

if [[ "$OPENAI_REQUIRED" == "1" ]]; then
  openai_payload='{"model":"mistral-awq","messages":[{"role":"user","content":"Smoke test openai"}],"stream":false}'
  openai_response="$(request POST "$BASE_URL/v1/chat/completions" "$openai_payload" "$auth_mode")"
  openai_status="$(printf '%s' "$openai_response" | head -n 1)"
  openai_body="$(printf '%s' "$openai_response" | tail -n +2)"
  if [[ "$openai_status" == "401" && -z "$API_KEY" ]]; then
    fail "POST /v1/chat/completions retornou 401 sem API key; defina PUBLIC_API_KEY (ou API_KEY) para smoke."
  else
    assert_status_and_contains "POST /v1/chat/completions" "$openai_status" "$openai_body" "200" '"object"[[:space:]]*:[[:space:]]*"chat.completion"'
  fi
fi

printf '\nResumo smoke API: ok=%d fail=%d\n' "$ok_count" "$fail_count"
if [[ "$fail_count" -gt 0 ]]; then
  exit 1
fi
exit 0
