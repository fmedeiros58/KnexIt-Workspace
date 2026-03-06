# API Write Routes

Data: 2026-03-03
Base path: /write

## 1) Escopo

As rotas de escrita ficam separadas do chat comum e formam um workspace orientado a editor com IA.

## 2) Rotas de escrita

### Rotas que alteram estado

- POST `/write/projects`
- PATCH `/write/projects/{project_id}`
- POST `/write/projects/{project_id}/sections`
- PATCH `/write/sections/{section_id}`
- POST `/write/insert`
- PATCH `/write/chunks/{chunk_id}`
- PATCH `/write/chunks/{chunk_id}/autosave`
- POST `/write/chunks/{chunk_id}/reindex`
- POST `/write/chunks/{chunk_id}/resummarize`
- POST `/write/sections/{section_id}/reindex`
- POST `/write/projects/{project_id}/reindex`
- POST `/write/continue`
- POST `/write/projects/{project_id}/memory`
- PATCH `/write/memory/{memory_id}`
- POST `/write/projects/{project_id}/memory/consolidate`
- POST `/write/sections/{section_id}/summarize`
- POST `/write/projects/{project_id}/summarize`

### Rotas de consulta

- GET `/write/projects`
- GET `/write/projects/{project_id}`
- GET `/write/projects/{project_id}/sections`
- GET `/write/projects/{project_id}/memory`
- GET `/write/projects/{project_id}/memory/inactive`
- GET `/write/chunks/{chunk_id}`
- GET `/write/chunks/{chunk_id}/versions`
- GET `/write/sections/{section_id}/summary`
- GET `/write/projects/{project_id}/summary`

## 3) Ciclo minimo suportado

1. Criar projeto (`POST /write/projects`).
2. Criar secoes (`POST /write/projects/{id}/sections`).
3. Carregar secoes para montar editor (`GET /write/projects/{id}/sections`).
4. Inserir trecho manual/programatico (`POST /write/insert`).
5. Continuar com IA (`POST /write/continue`).
6. Editar chunk sem perder historico (`PATCH /write/chunks/{id}`).
7. Autosave de chunk com controle de versao (`PATCH /write/chunks/{id}/autosave`).
8. Reindexar embedding quando necessario (`POST /write/chunks/{id}/reindex`, secao/projeto opcionais).
9. Recalcular resumo por chunk editado ou por escopo (`POST /write/chunks/{id}/resummarize`, `POST /write/sections/{id}/summarize` e `POST /write/projects/{id}/summarize`).
10. Gerenciar memoria de processo (`POST /write/projects/{id}/memory`, `PATCH /write/memory/{id}`, `POST /write/projects/{id}/memory/consolidate`).
11. Ler memoria ativa/inativa (`GET /write/projects/{id}/memory` e `GET /write/projects/{id}/memory/inactive`).
12. Ler resumos com indicador de defasagem (`GET /write/sections/{id}/summary` e `GET /write/projects/{id}/summary`).

## 4) Separacao de dominio

- Nenhuma rota `/write/*` reutiliza endpoint de chat comum.
- Regras de negocio ficam nos services (`WriteService`, `WriteContinueService`, `WriteSummaryService`).
- Controllers (`routes_write.py`) apenas validam e delegam.

## 5) Observacoes de autenticacao

No backend atual, nao ha middleware de autenticacao aplicado especificamente para `/write/*`. Portanto, as rotas seguem o mesmo nivel de acesso das demais rotas internas existentes.

## 6) Endpoints opcionais fora do escopo minimo

- `POST /write/projects/{project_id}/assist`
- `POST /write/projects/{project_id}/references`

Esses endpoints existem para suporte complementar, mas nao substituem o fluxo principal do editor com IA.
