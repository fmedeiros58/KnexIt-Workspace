#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ok_count=0
warn_count=0
fail_count=0

ok() {
  ok_count=$((ok_count + 1))
  printf '[OK] %s\n' "$1"
}

warn() {
  warn_count=$((warn_count + 1))
  printf '[WARN] %s\n' "$1"
}

fail() {
  fail_count=$((fail_count + 1))
  printf '[FAIL] %s\n' "$1"
}

load_env_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    return
  fi
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local value="${BASH_REMATCH[2]}"
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"
      export "$key=$value"
    fi
  done <"$file"
}

resolve_path() {
  local raw="$1"
  if [[ "$raw" =~ ^[A-Za-z]:[\\/].* ]]; then
    printf '%s\n' "$raw"
    return
  fi
  if [[ "$raw" == /* ]]; then
    printf '%s\n' "$raw"
    return
  fi
  printf '%s/%s\n' "$ROOT_DIR" "$raw"
}

path_exists() {
  local p="$1"
  if [[ "$p" =~ ^[A-Za-z]:[\\/].* ]]; then
    return 2
  fi
  [[ -e "$p" ]]
}

is_dir() {
  local p="$1"
  if [[ "$p" =~ ^[A-Za-z]:[\\/].* ]]; then
    return 2
  fi
  [[ -d "$p" ]]
}

is_file() {
  local p="$1"
  if [[ "$p" =~ ^[A-Za-z]:[\\/].* ]]; then
    return 2
  fi
  [[ -f "$p" ]]
}

check_file() {
  local label="$1"
  local path_raw="$2"
  local path_abs
  path_abs="$(resolve_path "$path_raw")"

  if ! is_file "$path_abs"; then
    local rc=$?
    if [[ $rc -eq 2 ]]; then
      warn "$label usa caminho Windows e nao pode ser validado no shell atual: $path_abs"
      return
    fi
    fail "$label inexistente: $path_abs"
    return
  fi

  if [[ ! -r "$path_abs" ]]; then
    fail "$label sem permissao de leitura: $path_abs"
    return
  fi

  ok "$label encontrado e legivel: $path_abs"
}

check_dir_readable() {
  local label="$1"
  local path_raw="$2"
  local path_abs
  path_abs="$(resolve_path "$path_raw")"

  if ! is_dir "$path_abs"; then
    local rc=$?
    if [[ $rc -eq 2 ]]; then
      warn "$label usa caminho Windows e nao pode ser validado no shell atual: $path_abs"
      return
    fi
    fail "$label inexistente: $path_abs"
    return
  fi

  if [[ ! -r "$path_abs" ]]; then
    fail "$label sem permissao de leitura: $path_abs"
    return
  fi

  if [[ -L "$path_abs" ]]; then
    warn "$label e symlink: $path_abs (verifique dependencia de boot/mount)."
  fi

  ok "$label encontrado e legivel: $path_abs"
}

check_dir_writable_or_creatable() {
  local label="$1"
  local path_raw="$2"
  local path_abs
  path_abs="$(resolve_path "$path_raw")"

  if is_dir "$path_abs"; then
    local probe="$path_abs/.nvme-verify-probe.$$"
    if ! printf 'ok' >"$probe" 2>/dev/null || ! cat "$probe" >/dev/null 2>&1; then
      fail "$label sem permissao de leitura/escrita: $path_abs"
      rm -f "$probe" >/dev/null 2>&1 || true
      return
    fi
    rm -f "$probe" >/dev/null 2>&1 || true
    ok "$label com leitura/escrita valida: $path_abs"
    return
  fi

  local rc=$?
  if [[ $rc -eq 2 ]]; then
    warn "$label usa caminho Windows e nao pode ser validado no shell atual: $path_abs"
    return
  fi

  local parent
  parent="$(dirname "$path_abs")"
  if [[ -d "$parent" && -w "$parent" ]]; then
    warn "$label ainda nao existe, mas o pai e gravavel: $path_abs"
  else
    fail "$label ausente e sem permissao para criacao: $path_abs"
  fi
}

print_effective() {
  local key="$1"
  local value="$2"
  printf '[INFO] %s=%s\n' "$key" "$value"
}

load_env_file ".env"
load_env_file ".env.local"

NVME_BASE_PATH="${NVME_BASE_PATH:-}"
MIGRATIONS_PATH="${MIGRATIONS_PATH:-supabase/migrations}"
KNEXAI_MIGRATION_FILE="${KNEXAI_MIGRATION_FILE:-$MIGRATIONS_PATH/20260302195000_create_knexai_unified_local.sql}"
VECTOR_MIGRATION_FILE="${VECTOR_MIGRATION_FILE:-$MIGRATIONS_PATH/20260303120000_create_rag_base_schema.sql}"
VECTOR_HNSW_MIGRATION_FILE="${VECTOR_HNSW_MIGRATION_FILE:-$MIGRATIONS_PATH/20260303130000_add_hnsw_index_chunk_embeddings.sql}"
LEGACY_MIGRATIONS_PATH="${LEGACY_MIGRATIONS_PATH:-supabase/migrations_legacy}"
STORAGE_BASE_PATH="${STORAGE_BASE_PATH:-data}"
DOCUMENTS_BASE_PATH="${DOCUMENTS_BASE_PATH:-docs}"
EMBEDDINGS_BASE_PATH="${EMBEDDINGS_BASE_PATH:-models}"
LOCAL_LLM_MODEL_DEFAULT="${LOCAL_LLM_MODEL_DEFAULT:-$EMBEDDINGS_BASE_PATH/CModelosMistral-7B-Instruct-v0.2-AWQ}"
TEMP_WORKDIR_PATH="${TEMP_WORKDIR_PATH:-.tmp}"
EXPORTS_BASE_PATH="${EXPORTS_BASE_PATH:-data/exports}"
ANM_CHECKPOINT_DIR="${ANM_CHECKPOINT_DIR:-data/checkpoints}"
RAG_RAW_DOCUMENTS_PATH="${RAG_RAW_DOCUMENTS_PATH:-$STORAGE_BASE_PATH/rag/raw}"
RAG_EXTRACTED_TEXT_PATH="${RAG_EXTRACTED_TEXT_PATH:-$STORAGE_BASE_PATH/rag/text}"
RAG_ADMIN_BULK_BASE_PATH="${RAG_ADMIN_BULK_BASE_PATH:-$STORAGE_BASE_PATH/rag/bulk}"
DOCKER_ENGINE_TEMPLATE_PATH="${DOCKER_ENGINE_TEMPLATE_PATH:-infra/docker/docker-desktop-engine.nvme2.json}"
DOCKER_DATA_ROOT="${DOCKER_DATA_ROOT:-/var/lib/docker}"
IDENTITY_MIGRATIONS_POLICY="${IDENTITY_MIGRATIONS_POLICY:-required}"
ANM_CHECKPOINT_RETENTION_DAYS="${ANM_CHECKPOINT_RETENTION_DAYS:-14}"
EXPORTS_RETENTION_DAYS="${EXPORTS_RETENTION_DAYS:-60}"

print_effective "MIGRATIONS_PATH" "$MIGRATIONS_PATH"
print_effective "KNEXAI_MIGRATION_FILE" "$KNEXAI_MIGRATION_FILE"
print_effective "VECTOR_MIGRATION_FILE" "$VECTOR_MIGRATION_FILE"
print_effective "VECTOR_HNSW_MIGRATION_FILE" "$VECTOR_HNSW_MIGRATION_FILE"
print_effective "ANM_CHECKPOINT_DIR" "$ANM_CHECKPOINT_DIR"
print_effective "STORAGE_BASE_PATH" "$STORAGE_BASE_PATH"
print_effective "TEMP_WORKDIR_PATH" "$TEMP_WORKDIR_PATH"
print_effective "EXPORTS_BASE_PATH" "$EXPORTS_BASE_PATH"
print_effective "RAG_RAW_DOCUMENTS_PATH" "$RAG_RAW_DOCUMENTS_PATH"
print_effective "RAG_EXTRACTED_TEXT_PATH" "$RAG_EXTRACTED_TEXT_PATH"
print_effective "RAG_ADMIN_BULK_BASE_PATH" "$RAG_ADMIN_BULK_BASE_PATH"
print_effective "DOCUMENTS_BASE_PATH" "$DOCUMENTS_BASE_PATH"
print_effective "EMBEDDINGS_BASE_PATH" "$EMBEDDINGS_BASE_PATH"
print_effective "LOCAL_LLM_MODEL_DEFAULT" "$LOCAL_LLM_MODEL_DEFAULT"
print_effective "DOCKER_ENGINE_TEMPLATE_PATH" "$DOCKER_ENGINE_TEMPLATE_PATH"
print_effective "DOCKER_DATA_ROOT" "$DOCKER_DATA_ROOT"
print_effective "IDENTITY_MIGRATIONS_POLICY" "$IDENTITY_MIGRATIONS_POLICY"
print_effective "ANM_CHECKPOINT_RETENTION_DAYS" "$ANM_CHECKPOINT_RETENTION_DAYS"
print_effective "EXPORTS_RETENTION_DAYS" "$EXPORTS_RETENTION_DAYS"

if [[ -n "$NVME_BASE_PATH" ]]; then
  nvme_abs="$(resolve_path "$NVME_BASE_PATH")"
  print_effective "NVME_BASE_PATH" "$NVME_BASE_PATH"
  if is_dir "$nvme_abs"; then
    ok "NVME_BASE_PATH existente: $nvme_abs"
    if command -v mountpoint >/dev/null 2>&1; then
      if mountpoint -q "$nvme_abs"; then
        ok "NVME_BASE_PATH e mountpoint ativo: $nvme_abs"
      else
        warn "NVME_BASE_PATH existe mas nao e mountpoint dedicado: $nvme_abs"
      fi
    fi
  else
    rc=$?
    if [[ $rc -eq 2 ]]; then
      warn "NVME_BASE_PATH em formato Windows nao validado no shell atual: $nvme_abs"
    else
      fail "NVME_BASE_PATH configurado, mas inexistente: $nvme_abs"
    fi
  fi
else
  warn "NVME_BASE_PATH nao definido (fallback para paths relativos do repo)."
fi

if ! [[ "$ANM_CHECKPOINT_RETENTION_DAYS" =~ ^[0-9]+$ ]] || [[ "$ANM_CHECKPOINT_RETENTION_DAYS" -le 0 ]]; then
  fail "ANM_CHECKPOINT_RETENTION_DAYS invalido: $ANM_CHECKPOINT_RETENTION_DAYS"
fi
if ! [[ "$EXPORTS_RETENTION_DAYS" =~ ^[0-9]+$ ]] || [[ "$EXPORTS_RETENTION_DAYS" -le 0 ]]; then
  fail "EXPORTS_RETENTION_DAYS invalido: $EXPORTS_RETENTION_DAYS"
fi
if [[ "$IDENTITY_MIGRATIONS_POLICY" != "required" && "$IDENTITY_MIGRATIONS_POLICY" != "optional" ]]; then
  fail "IDENTITY_MIGRATIONS_POLICY invalido: $IDENTITY_MIGRATIONS_POLICY (use required|optional)"
fi

check_dir_readable "Diretorio de migrations" "$MIGRATIONS_PATH"
check_file "Migration unificada KnexAI" "$KNEXAI_MIGRATION_FILE"
check_file "Migration pgvector" "$VECTOR_MIGRATION_FILE"
check_file "Migration HNSW" "$VECTOR_HNSW_MIGRATION_FILE"
check_dir_readable "Diretorio de migrations legadas" "$LEGACY_MIGRATIONS_PATH"
check_dir_readable "Diretorio de documentos" "$DOCUMENTS_BASE_PATH"
check_dir_readable "Diretorio de modelos" "$EMBEDDINGS_BASE_PATH"
check_file "Template Docker Engine" "$DOCKER_ENGINE_TEMPLATE_PATH"

check_dir_writable_or_creatable "Storage base" "$STORAGE_BASE_PATH"
check_dir_writable_or_creatable "Diretorio temporario persistente" "$TEMP_WORKDIR_PATH"
check_dir_writable_or_creatable "Diretorio de exportacoes" "$EXPORTS_BASE_PATH"
check_dir_writable_or_creatable "Checkpoint ANM" "$ANM_CHECKPOINT_DIR"
check_dir_writable_or_creatable "Diretorio RAG de documentos brutos" "$RAG_RAW_DOCUMENTS_PATH"
check_dir_writable_or_creatable "Diretorio RAG de texto extraido" "$RAG_EXTRACTED_TEXT_PATH"
check_dir_writable_or_creatable "Diretorio RAG de ingestao em massa" "$RAG_ADMIN_BULK_BASE_PATH"

template_abs="$(resolve_path "$DOCKER_ENGINE_TEMPLATE_PATH")"
if [[ -f "$template_abs" ]]; then
  template_data_root="$(sed -n 's/.*"data-root"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$template_abs" | head -n 1)"
  if [[ -z "$template_data_root" ]]; then
    fail "Template Docker Engine sem 'data-root': $template_abs"
  elif [[ "$template_data_root" != "$DOCKER_DATA_ROOT" ]]; then
    fail "Template Docker Engine diverge de DOCKER_DATA_ROOT (template='$template_data_root' esperado='$DOCKER_DATA_ROOT')."
  else
    ok "Template Docker Engine consistente com DOCKER_DATA_ROOT."
  fi
fi

daemon_path="$HOME/.docker/daemon.json"
if [[ ! -f "$daemon_path" ]]; then
  for candidate in /mnt/c/Users/*/.docker/daemon.json; do
    if [[ -f "$candidate" ]]; then
      daemon_path="$candidate"
      break
    fi
  done
fi
if [[ -f "$daemon_path" ]]; then
  daemon_data_root="$(sed -n 's/.*"data-root"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$daemon_path" | head -n 1)"
  if [[ -z "$daemon_data_root" ]]; then
    warn "daemon.json sem 'data-root' explicito: $daemon_path"
  elif [[ "$daemon_data_root" != "$DOCKER_DATA_ROOT" ]]; then
    fail "daemon.json diverge de DOCKER_DATA_ROOT (daemon='$daemon_data_root' esperado='$DOCKER_DATA_ROOT')."
  else
    ok "daemon.json consistente com DOCKER_DATA_ROOT."
  fi
else
  warn "daemon.json ausente em $daemon_path (estado do host pode estar fora do escopo do shell atual)."
fi

if command -v docker >/dev/null 2>&1; then
  docker_root="$(docker info --format "{{.DockerRootDir}}" 2>/dev/null || true)"
  if [[ -z "$docker_root" ]]; then
    fail "Nao foi possivel ler DockerRootDir (docker daemon indisponivel)."
  elif [[ "$docker_root" != "$DOCKER_DATA_ROOT" ]]; then
    fail "DockerRootDir diverge de DOCKER_DATA_ROOT (runtime='$docker_root' esperado='$DOCKER_DATA_ROOT')."
  else
    ok "DockerRootDir consistente com DOCKER_DATA_ROOT."
  fi
else
  fail "Docker CLI indisponivel no shell atual."
fi

mig_abs="$(resolve_path "$MIGRATIONS_PATH")"
knx_abs="$(resolve_path "$KNEXAI_MIGRATION_FILE")"
vec_abs="$(resolve_path "$VECTOR_MIGRATION_FILE")"
hnsw_abs="$(resolve_path "$VECTOR_HNSW_MIGRATION_FILE")"
if [[ ! "$knx_abs" =~ ^[A-Za-z]:[\\/].* ]] && [[ "$knx_abs" != "$mig_abs"/* ]]; then
  warn "KNEXAI_MIGRATION_FILE fora de MIGRATIONS_PATH. Revise consistencia."
else
  ok "KNEXAI_MIGRATION_FILE consistente com MIGRATIONS_PATH."
fi

if [[ ! "$vec_abs" =~ ^[A-Za-z]:[\\/].* ]] && [[ "$vec_abs" != "$mig_abs"/* ]]; then
  warn "VECTOR_MIGRATION_FILE fora de MIGRATIONS_PATH. Revise consistencia."
else
  ok "VECTOR_MIGRATION_FILE consistente com MIGRATIONS_PATH."
fi

if [[ ! "$hnsw_abs" =~ ^[A-Za-z]:[\\/].* ]] && [[ "$hnsw_abs" != "$mig_abs"/* ]]; then
  warn "VECTOR_HNSW_MIGRATION_FILE fora de MIGRATIONS_PATH. Revise consistencia."
else
  ok "VECTOR_HNSW_MIGRATION_FILE consistente com MIGRATIONS_PATH."
fi

if [[ -f "supabase/config.toml" ]]; then
  ok "Estrutura supabase/config.toml presente."
else
  fail "Arquivo supabase/config.toml ausente."
fi

identity_path="supabase/identity/migrations"
if [[ -d "$identity_path" ]]; then
  ok "Diretorio de migrations de identidade presente."
  mapfile -t identity_files < <(find "$identity_path" -maxdepth 1 -type f -name "*.sql" | sort)
  if [[ "${#identity_files[@]}" -eq 0 ]]; then
    warn "Diretorio de identidade sem arquivos .sql: $identity_path"
  else
    project_id="$(sed -n 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' supabase/config.toml | head -n 1)"
    if [[ -z "$project_id" ]]; then
      fail "Nao foi possivel resolver project_id para validar migrations de identidade."
    else
      db_container="supabase_db_${project_id}"
      if ! docker ps --format "{{.Names}}" | grep -q "^${db_container}$"; then
        if [[ "$IDENTITY_MIGRATIONS_POLICY" == "required" ]]; then
          fail "Container do Supabase local indisponivel para validar identity migrations: $db_container"
        else
          warn "Container do Supabase local indisponivel para validar identity migrations: $db_container"
        fi
      else
        for file in "${identity_files[@]}"; do
          base="$(basename "$file" .sql)"
          if [[ ! "$base" =~ ^([0-9]+)_ ]]; then
            fail "Identity migration sem prefixo numerico: $(basename "$file")"
            continue
          fi
          version="${BASH_REMATCH[1]}"
          exists="$(docker exec "$db_container" psql -U postgres -d postgres -Atc "select 1 from supabase_migrations.schema_migrations where version='${version}' limit 1;" 2>/dev/null || true)"
          if [[ "$exists" == "1" ]]; then
            ok "Identity migration aplicada: version=$version file=$(basename "$file")"
          else
            if [[ "$IDENTITY_MIGRATIONS_POLICY" == "required" ]]; then
              fail "Identity migration pendente: version=$version file=$(basename "$file")"
            else
              warn "Identity migration pendente: version=$version file=$(basename "$file")"
            fi
          fi
        done
      fi
    fi
  fi
else
  warn "Diretorio de migrations de identidade ausente: $identity_path"
fi

if [[ -f "supabase/config.toml" ]]; then
  project_id="$(sed -n 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' supabase/config.toml | head -n 1)"
  if [[ -z "$project_id" ]]; then
    fail "Nao foi possivel resolver project_id para validar extensao vector."
  else
    db_container="supabase_db_${project_id}"
    if ! docker ps --format "{{.Names}}" | grep -q "^${db_container}$"; then
      fail "Container do Supabase local indisponivel para validar extensao vector: $db_container"
    else
      has_vector="$(docker exec "$db_container" psql -U postgres -d postgres -Atc "select 1 from pg_extension where extname='vector' limit 1;" 2>/dev/null || true)"
      if [[ "$has_vector" == "1" ]]; then
        ok "Extensao pgvector habilitada no banco local."
      else
        fail "Extensao pgvector ausente no banco local (esperado: CREATE EXTENSION vector)."
      fi

      required_tables=(
        "vector_store.document_sources"
        "vector_store.documents"
        "vector_store.document_chunks"
        "vector_store.chunk_embeddings"
        "vector_store.ingestion_jobs"
      )
      for table_name in "${required_tables[@]}"; do
        exists="$(docker exec "$db_container" psql -U postgres -d postgres -Atc "select to_regclass('${table_name}') is not null;" 2>/dev/null || true)"
        if [[ "$exists" == "t" || "$exists" == "true" ]]; then
          ok "Tabela RAG presente: $table_name"
        else
          fail "Tabela RAG ausente: $table_name"
        fi
      done

      has_hnsw_index="$(docker exec "$db_container" psql -U postgres -d postgres -Atc "select to_regclass('vector_store.chunk_embeddings_embedding_hnsw_cosine_idx') is not null;" 2>/dev/null || true)"
      if [[ "$has_hnsw_index" == "t" || "$has_hnsw_index" == "true" ]]; then
        ok "Indice HNSW presente: vector_store.chunk_embeddings_embedding_hnsw_cosine_idx"
      else
        fail "Indice HNSW ausente: vector_store.chunk_embeddings_embedding_hnsw_cosine_idx"
      fi
    fi
  fi
fi

printf '\nResumo: ok=%d warn=%d fail=%d\n' "$ok_count" "$warn_count" "$fail_count"
if [[ "$fail_count" -gt 0 ]]; then
  exit 1
fi
exit 0
