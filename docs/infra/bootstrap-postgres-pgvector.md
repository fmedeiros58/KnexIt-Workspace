# Bootstrap Postgres + pgvector (Etapa 2)

Data: 2026-03-03  
Escopo: adicionar camada vetorial em Postgres + pgvector sem substituir nem quebrar a arquitetura atual.

## 1) Estado anterior encontrado

### 1.1 Stack detectada automaticamente

- Linguagem/backend principal: TypeScript + Next.js 14 (`app/api/*`) e serviços auxiliares locais.
- Banco principal em uso: Postgres via Supabase (local/remoto), acessado majoritariamente por `@supabase/supabase-js`.
- Ferramenta de migration atual: SQL migrations em `supabase/migrations` + scripts PowerShell/bash para bootstrap local.
- ORM/query builder detectado: nenhum ORM ativo (sem Prisma/TypeORM/Sequelize/Drizzle/Knex em runtime).

### 1.2 Multi-conexao (estado anterior)

- Ja existiam conexoes logicas separadas para:
  - projeto Supabase principal (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
  - projeto de identidade (`NEXT_PUBLIC_IDENTITY_SUPABASE_URL`, `IDENTITY_SUPABASE_SERVICE_ROLE_KEY`)
- Nao existia cliente dedicado para conexao vetorial Postgres via driver SQL no modulo `core/database`.

### 1.3 Onde estavam config/env/bootstrap

- Config de env central: `core/config/env.ts`
- Cliente de banco base (stub): `core/database/client.ts`
- Bootstrap Supabase local: `scripts/supabase-local-start.ps1`
- Verificacao operacional: `scripts/verify-nvme-setup.ps1` e `scripts/verify-nvme-setup.sh`
- Migrations SQL: `supabase/migrations/*.sql`

## 2) Decisao tomada

Foi adicionada uma camada vetorial dedicada em Postgres + pgvector, sem remover o banco atual e sem migracao destrutiva.

Decisoes:

1. Manter Supabase/Postgres atual como base da aplicacao.
2. Adicionar conexao vetorial dedicada por configuracao (`VECTOR_DATABASE_URL` ou `VECTOR_DB_*`).
3. Centralizar dimensao de embedding em `EMBEDDING_DIMENSION` (default `768`) na configuracao.
4. Habilitar `pgvector` via migration SQL idempotente (`CREATE EXTENSION IF NOT EXISTS vector`).
5. Preservar compatibilidade: nenhum modulo legado foi removido; nenhuma tabela antiga foi apagada.

## 3) Como a conexao vetorial foi adicionada

### 3.1 Config centralizada

Arquivo: `core/config/env.ts`

- Adicionado `loadVectorDatabaseConfig()` com fallback em cadeia:
  - `VECTOR_DATABASE_URL`
  - `DATABASE_URL`
  - montagem de URL com `VECTOR_DB_HOST/PORT/NAME/USER/PASSWORD`
- Adicionado parsing de `VECTOR_DB_SSL` e dimensao central `EMBEDDING_DIMENSION`.
- Valor base de dimensao definido em uma unica fonte no codigo: `DEFAULT_EMBEDDING_DIMENSION = 768`.

### 3.2 Cliente vetorial dedicado

Arquivo: `core/database/vector-client.ts`

- Novo cliente `VectorDatabaseClient` baseado em `pg` (`Pool`).
- Suporte a:
  - `connect()`
  - `query()`
  - `withClient()`
  - `ensurePgVectorExtension()`
- Fabrica: `createVectorDatabaseClient()` usando `loadVectorDatabaseConfig()`.

### 3.3 Bootstrap/migration pgvector

Arquivos:

- `supabase/migrations/20260303120000_create_rag_base_schema.sql`
- `supabase/migrations/20260303130000_add_hnsw_index_chunk_embeddings.sql`

- `CREATE EXTENSION IF NOT EXISTS vector;`
- Cria schema base RAG (`document_sources`, `documents`, `document_chunks`, `chunk_embeddings`, `ingestion_jobs`) de forma idempotente.
- Nao remove nem altera destrutivamente estruturas existentes.

### 3.4 Fluxo de bootstrap local atualizado

Arquivo: `scripts/supabase-local-start.ps1`

- Continua aplicando migration principal do KnexAI.
- Agora aplica tambem migrations vetoriais:
  - `VECTOR_MIGRATION_FILE` (schema base RAG)
  - `VECTOR_HNSW_MIGRATION_FILE` (indice HNSW)
- Atualiza `.env.local` com `VECTOR_DATABASE_URL` a partir de `DB_URL` do Supabase local.

### 3.5 Validacao operacional atualizada

Arquivos:

- `scripts/verify-nvme-setup.ps1`
- `scripts/verify-nvme-setup.sh`

Checagens adicionadas:

- existencia/leitura de `VECTOR_MIGRATION_FILE`
- consistencia `VECTOR_MIGRATION_FILE` x `MIGRATIONS_PATH`
- confirmacao runtime da extensao `vector` no banco (`pg_extension`)

## 4) Variaveis de ambiente necessarias

Adicionadas em `.env.example`:

- `VECTOR_DATABASE_URL`
- `VECTOR_DB_HOST`
- `VECTOR_DB_PORT`
- `VECTOR_DB_NAME`
- `VECTOR_DB_USER`
- `VECTOR_DB_PASSWORD`
- `VECTOR_DB_SSL`
- `EMBEDDING_DIMENSION`
- `VECTOR_MIGRATION_FILE`

Regra de resolucao:

1. Se `VECTOR_DATABASE_URL` estiver preenchido, ele e usado.
2. Senao, se `DATABASE_URL` estiver disponivel, ele e reaproveitado.
3. Senao, a URL e montada com `VECTOR_DB_*`.

## 5) Dependencias adicionadas

- Runtime: `pg`
- Dev/type support: `@types/pg`

## 6) Como reproduzir em outro ambiente

1. Instalar dependencias:

```bash
npm i
```

2. Garantir variaveis de env (ou usar `.env.example` como base).

3. Subir bootstrap local (aplica migrations principal + vetorial):

```bash
powershell -ExecutionPolicy Bypass -File scripts/supabase-local-start.ps1
```

4. (Se necessario) aplicar identidade:

```bash
npm run supabase:local:identity:migrate
```

5. Validar ambiente:

```bash
npm run verify:nvme
npm run verify:nvme:sh
```

6. Validar compilacao TypeScript:

```bash
npx tsc --noEmit
```

## 7) Riscos e compatibilidades

### Compatibilidades preservadas

- Banco atual nao foi removido nem substituido.
- Fluxo existente de Supabase/Identity foi mantido.
- Sem migracao de dados antigos nesta etapa.

### Riscos remanescentes

- Ambiente do servidor precisa ter suporte a extensao `vector` no Postgres alvo.
- Se usar DB remoto gerenciado, pode haver restricao para `CREATE EXTENSION`.
- `EMBEDDING_DIMENSION=768` e a dimensao-base operacional atual; qualquer troca futura exige alinhamento entre ingestao e busca.

## 8) Evidencia de validacao desta implementacao

Comandos executados no ambiente atual:

- `powershell -ExecutionPolicy Bypass -File scripts/supabase-local-start.ps1 -SkipEnvUpdate`
- `npm run verify:nvme` (resultado: `ok=23 warn=0 fail=0`)
- `npm run verify:nvme:sh` (resultado: `ok=24 warn=0 fail=0`)
- `npx tsc --noEmit` (sem erros)

Resultado tecnico observado:

- migration vetorial aplicada com sucesso;
- extensao `vector` presente em `pg_extension`;
- base pronta para evolucao RAG sem impacto destrutivo na arquitetura atual.

