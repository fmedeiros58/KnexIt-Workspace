#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IDENTITY_MIGRATIONS_PATH="${1:-supabase/identity/migrations}"

if [[ ! -d "$IDENTITY_MIGRATIONS_PATH" ]]; then
  echo "Diretorio de migrations de identidade nao encontrado: $IDENTITY_MIGRATIONS_PATH"
  exit 1
fi

if [[ ! -f "supabase/config.toml" ]]; then
  echo "Arquivo supabase/config.toml nao encontrado."
  exit 1
fi

PROJECT_ID="$(sed -n 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' supabase/config.toml | head -n 1)"
if [[ -z "$PROJECT_ID" ]]; then
  echo "Nao foi possivel ler project_id em supabase/config.toml"
  exit 1
fi

DB_CONTAINER="supabase_db_${PROJECT_ID}"
if ! docker ps --format "{{.Names}}" | grep -q "^${DB_CONTAINER}$"; then
  echo "Container do Supabase local nao esta ativo: $DB_CONTAINER. Rode 'npm run supabase:local:start' antes."
  exit 1
fi

mapfile -t files < <(find "$IDENTITY_MIGRATIONS_PATH" -maxdepth 1 -type f -name "*.sql" | sort)
if [[ "${#files[@]}" -eq 0 ]]; then
  echo "Nenhuma migration de identidade encontrada em $IDENTITY_MIGRATIONS_PATH."
  exit 0
fi

for file in "${files[@]}"; do
  base="$(basename "$file" .sql)"
  if [[ ! "$base" =~ ^([0-9]+)_ ]]; then
    echo "Arquivo sem prefixo de versao numerico: $(basename "$file")"
    exit 1
  fi
  version="${BASH_REMATCH[1]}"

  already="$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -Atc "select 1 from supabase_migrations.schema_migrations where version='${version}' limit 1;" 2>/dev/null || true)"
  if [[ "$already" == "1" ]]; then
    echo "SKIP identity migration (ja aplicada): version=$version file=$(basename "$file")"
    continue
  fi

  echo "APPLY identity migration: version=$version file=$(basename "$file")"
  docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$file"
  docker exec "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "insert into supabase_migrations.schema_migrations(version,name) values ('${version}','identity_${base}') on conflict (version) do nothing;" >/dev/null
  echo "OK identity migration: version=$version file=$(basename "$file")"
done

echo "Identity migrations concluida."

