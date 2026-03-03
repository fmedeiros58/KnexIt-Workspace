# ADR-001 - Persistencia em NVMe/NVMe2

- Status: Aceito
- Data: 2026-03-03
- Responsavel: Time KnexIT
- Escopo: `knexit-workspace` (Next.js + Supabase local + ANM backend)

## Contexto do problema

O projeto tinha risco operacional por:
- paths hardcoded em scripts e runtime;
- fluxo de migration com historico legado e migration unificada coexistindo;
- configuracao critica de Docker (`daemon.json`) fora do versionamento;
- falta de verificacao padronizada de permissao/leitura/escrita;
- baixa rastreabilidade para reproduzir o ambiente em outra maquina.

Como a persistencia local e parte do desempenho (SQL local + camada quente em RAM), era necessario padronizar o uso de paths e formalizar validacao de integridade.

## Decisao tomada

Foi adotada uma estrategia de consolidacao por configuracao e verificacao:

1. Paths centralizados por variaveis de ambiente e utilitario de resolucao:
- `core/config/paths.ts` (`loadPathConfig()`).

2. Fluxo de migration local consolidado:
- migration ativa: `supabase/migrations/20260302195000_create_knexai_unified_local.sql`;
- suporte explicito a `MIGRATIONS_PATH` e `KNEXAI_MIGRATION_FILE`.
- migrations de identidade aplicadas por fluxo oficial:
  - `npm run supabase:local:identity:migrate`
  - validacao por `IDENTITY_MIGRATIONS_POLICY=required`.

3. Validacoes operacionais obrigatorias em pontos de execucao:
- `scripts/supabase-local-start.ps1`;
- `scripts/serve-anm.sh`;
- `anm_backend/main.py`.

4. Verificacao auditavel cross-platform:
- `scripts/verify-nvme-setup.ps1`;
- `scripts/verify-nvme-setup.sh`;
- scripts npm: `verify:nvme` e `verify:nvme:sh`.

5. Estado de referencia atual (ambiente local validado):
- `NVME_BASE_PATH=/mnt/c`
- `DOCKER_DATA_ROOT=/var/lib/docker`
- `MIGRATIONS_PATH=supabase/migrations`
- `KNEXAI_MIGRATION_FILE=supabase/migrations/20260302195000_create_knexai_unified_local.sql`
- `ANM_CHECKPOINT_RETENTION_DAYS=14`
- `EXPORTS_RETENTION_DAYS=60`

## Motivacao tecnica

- Reduzir falhas silenciosas por path invalido.
- Garantir mensagens de erro explicitas e reproduziveis.
- Detectar drift entre template Docker, `daemon.json` e runtime (`DockerRootDir`).
- Permitir auditoria objetiva por script, sem analise manual difusa.

## Alternativas consideradas

1. Manter hardcodes e tratar caso a caso.
- Rejeitada: baixa auditabilidade, alto risco de regressao operacional.

2. Refatorar arquitetura completa de persistencia.
- Rejeitada nesta etapa: risco alto e escopo excessivo para o objetivo imediato.

3. Criar nova stack de configuracao/infra.
- Rejeitada: aumento de complexidade e dependencia desnecessaria.

## Impactos positivos

- Integridade validada de forma repetivel (`ok/warn/fail` com exit code).
- Paths criticos com preflight de existencia e permissao.
- Menor acoplamento a path absoluto especifico.
- Melhor capacidade de handover para outro operador/maquina.

## Riscos

1. Dependencia de WSL para paths POSIX em host Windows.
2. `daemon.json` continua sendo estado de maquina (nao versionado em Git).
3. `NVME_BASE_PATH=/mnt/c` valida consistencia estrutural, mas nao comprova que o volume fisico e NVMe dedicado.
4. Realocacao para NVMe dedicado real depende de janela operacional e disponibilidade do host.

## Trade-offs

- Pro:
  - previsibilidade operacional sem mudar logica de negocio.
  - validacao rapida em CI/local.
- Contra:
  - mais checks de preflight aumentam rigidez (falha mais cedo).
  - continua existindo dependencia de estado do host para Docker.

## Consequencias futuras

- Novos modulos que persistirem dados devem usar os mesmos padroes de path e entrar no script de verificacao.
- Mudancas em `DOCKER_DATA_ROOT` exigem atualizacao sincronizada de:
  - `.env.local` / secret manager
  - template `infra/docker/docker-desktop-engine.nvme2.json`
  - `daemon.json` do host
  - validacao `verify:nvme`
- Se houver migracao para NVMe dedicado real (ex.: `/mnt/nvme2`), deve-se atualizar `NVME_BASE_PATH` e revalidar.
- Se `IDENTITY_MIGRATIONS_POLICY=required`, o deploy local deve incluir `npm run supabase:local:identity:migrate` antes da validacao final.
- Retencao de checkpoints/exports deve respeitar:
  - `ANM_CHECKPOINT_RETENTION_DAYS`
  - `EXPORTS_RETENTION_DAYS`

## Dependencias

- Docker Desktop + Docker CLI
- WSL (para paths POSIX em Windows)
- Node.js 18+
- PowerShell (Windows)
- Bash (WSL/Linux)
- Supabase CLI via `npx`

## Evidencias de implementacao

- Config: `core/config/paths.ts`
- Start Supabase local: `scripts/supabase-local-start.ps1`
- Apply identity migrations: `scripts/supabase-apply-identity-migrations.ps1`, `scripts/supabase-apply-identity-migrations.sh`
- Start ANM: `scripts/serve-anm.sh`, `scripts/serve-anm-wsl.ps1`
- Validacao operacional: `scripts/verify-nvme-setup.ps1`, `scripts/verify-nvme-setup.sh`
- Runtime guard ANM: `anm_backend/main.py`
- Referencias operacionais:
  - `docs/infra/padroes-de-paths-nvme.md`
  - `docs/infra/verificacao-operacional-nvme.md`
