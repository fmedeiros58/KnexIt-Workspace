# Fluxo Completo de Edicao no Modo Escrita

Data: 2026-03-03
Escopo: fluxo ponta a ponta de edicao/versionamento/autosave/reindex/resumo/memoria.

## 1) Edicao de chunk

1. frontend envia `PATCH /write/chunks/{chunk_id}`.
2. backend atualiza chunk atual (`draft_chunks`).
3. backend cria snapshot em `draft_chunk_versions`.

Resultado:
- edicao nao destrutiva;
- versao atual incrementada;
- historico preservado.

## 2) Autosave

1. frontend envia `PATCH /write/chunks/{chunk_id}/autosave` com `client_version`.
2. backend valida versao cliente vs servidor.
3. em sucesso, salva nova versao; em conflito, retorna `409`.

Resultado:
- sem overwrite cego;
- conflito simples explicito.

## 3) Reindexacao

Opcoes:
- imediata por flags em patch/autosave;
- explicita por `POST /write/chunks/{id}/reindex` (ou escopo secao/projeto).

Resultado:
- embedding alinhado ao texto vigente.

## 4) Re-sumarizacao

Opcoes:
- por secao: `POST /write/sections/{id}/summarize`;
- por projeto: `POST /write/projects/{id}/summarize`;
- por chunk editado: `POST /write/chunks/{id}/resummarize` (secao + projeto).

Leitura:
- `GET .../summary` retorna `is_stale` e `stale_reasons`.

Resultado:
- resumos coerentes com o estado atual.

## 5) Consolidacao de memoria

1. `POST /write/projects/{id}/memory/consolidate`.
2. deduplica e/ou desativa itens obsoletos com trilha auditavel.
3. `PATCH /write/memory/{id}` permite ajuste manual.

Resultado:
- memoria controlada sem perda silenciosa.

## 6) Interacao entre componentes

- Edicao/autosave alteram texto atual e versao.
- Reindexacao garante retrieval coerente com o texto atual.
- Re-sumarizacao garante contexto sintetico coerente.
- Consolidacao de memoria melhora qualidade do contexto recuperado no `/write/continue`.
- Jobs operacionais mantem o dominio previsivel ao longo do tempo.
