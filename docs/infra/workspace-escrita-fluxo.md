# Workspace Escrita - Fluxo Operacional

Data: 2026-03-03

## 1) Criacao de projeto

- `POST /write/projects`
- resultado: `project_id` inicial para sessao de edicao.

## 2) Criacao de secoes

- `POST /write/projects/{project_id}/sections`
- cada secao recebe `title`, `objective`, `outline_notes`, `order`, `status`.

## 3) Insercao de chunks

- `POST /write/insert`
- uso: persistir texto manual/programatico no backend.
- opcoes explicitas: `update_embedding`, `summarize_section`, `summarize_project`.

## 4) Edicao de chunks

- `PATCH /write/chunks/{chunk_id}`
- leitura do estado atual: `GET /write/chunks/{chunk_id}`
- trilha de auditoria de versoes: `GET /write/chunks/{chunk_id}/versions`

## 5) Autosave de editor

- `PATCH /write/chunks/{chunk_id}/autosave`
- entrada principal: `content`, `client_version`, `autosave_reason`, `editor_session_id`
- conflito simples: `409` quando `client_version` estiver desatualizada

## 6) Reindexacao pos-edicao

- por chunk: `POST /write/chunks/{chunk_id}/reindex`
- por secao: `POST /write/sections/{section_id}/reindex`
- por projeto: `POST /write/projects/{project_id}/reindex`
- estrategia: 1 embedding ativo por chunk atual (upsert)

## 7) Continuacao com IA (`POST /write/continue`)

Fluxo interno, explicito e auditavel:

1. resolve alvo de escrita (projeto + secao)
2. monta query semantica a partir de instrucao, objetivo e estado de secao
3. recupera chunks similares (top-k) para reduzir repeticao
4. recupera memoria de processo relevante (top-k) para manter coerencia
5. carrega resumo de secao + resumo global
6. monta context pack unico (prompt assembly centralizado)
7. chama LLM interno para gerar somente o proximo bloco
8. persiste chunk gerado e embedding

## 8) Atualizacao de resumos

- secao: `POST /write/sections/{section_id}/summarize`
- projeto: `POST /write/projects/{project_id}/summarize`
- consulta: `GET /write/sections/{section_id}/summary` e `GET /write/projects/{project_id}/summary`

## 9) Consulta do estado do manuscrito

- projeto completo: `GET /write/projects/{project_id}`
- secoes para editor: `GET /write/projects/{project_id}/sections`
- memoria de processo: `GET /write/projects/{project_id}/memory`

## 10) Interacao entre memoria, resumos e anti-redundancia

- `process_memory` guarda regras/decisoes/terminologia que devem ser preservadas.
- `section_summaries` reduz contexto bruto da secao para continuidade local.
- `project_global_summaries` reduz contexto bruto do manuscrito para continuidade global.
- o fluxo de continue writing combina essas tres camadas antes de gerar o bloco.

## 11) Lacunas atuais (documentadas)

- repositorio atual do write workspace e in-memory (sem durabilidade de producao);
- sem lock concorrente/controle otimista para edicao simultanea;
- sem atualizacao automatica obrigatoria de resumo apos todo chunk.
