#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-}"
API_KEY="${API_KEY:-${PUBLIC_API_KEY:-}}"
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

request_json() {
  local method="$1"
  local url="$2"
  local body="$3"

  local -a args
  args=(-sS -X "$method" "$url" -H "Content-Type: application/json" -d "$body")
  if [[ -n "$API_KEY" ]]; then
    args+=(-H "x-api-key: $API_KEY")
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

printf '[INFO] BASE_URL=%s\n' "$BASE_URL"
printf '[INFO] CURL_BIN=%s\n' "$CURL_BIN"
if [[ -n "$API_KEY" ]]; then
  printf '[INFO] API_KEY=definida\n'
else
  printf '[WARN] API_KEY nao definida; rotas protegidas podem retornar 401.\n'
fi

query_payload='{"question":"Teste de retrieval minimo","topK":3}'
query_response="$(request_json POST "$BASE_URL/query" "$query_payload")"
query_status="$(printf '%s' "$query_response" | head -n 1)"
query_body="$(printf '%s' "$query_response" | tail -n +2)"

if [[ "$query_status" == "401" && -z "$API_KEY" ]]; then
  fail "POST /query retornou 401 sem API key; defina PUBLIC_API_KEY (ou API_KEY) para smoke."
elif [[ "$query_status" != "200" ]]; then
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

if [[ "$openai_status" == "401" && -z "$API_KEY" ]]; then
  fail "POST /v1/chat/completions retornou 401 sem API key; defina PUBLIC_API_KEY (ou API_KEY) para smoke."
elif [[ "$openai_status" != "200" ]]; then
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
