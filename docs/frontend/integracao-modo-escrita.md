# Integracao Frontend - Modo Escrita

Data: 2026-03-03

## 1) Bootstrap da tela

1. Criar projeto (`POST /write/projects`) ou recuperar `project_id` existente.
2. Carregar estado base:
- `GET /write/projects/{project_id}`
- `GET /write/projects/{project_id}/sections?include_chunks=true&include_summaries=true`

## 2) Montagem do editor

Para cada secao renderizar:

- titulo
- objetivo
- outline_notes
- status
- lista ordenada de chunks
- resumo de secao quando disponivel (`summary_record`)

## 3) Insercao manual

Sempre que o usuario confirmar insercao:

- chamar `POST /write/insert`
- atualizar localmente o estado da secao com o chunk retornado
- opcional: solicitar summarize imediato via flags ou endpoint separado

## 4) Continuacao IA

Ao pedir continuacao:

- chamar `POST /write/continue`
- anexar chunk retornado na secao atual
- guardar ids de retrieval retornados para auditoria de UI (opcional)

## 5) Edicao de chunk

- carregar estado atual quando necessario: `GET /write/chunks/{chunk_id}`
- aplicar revisao: `PATCH /write/chunks/{chunk_id}`
- consultar historico de versoes: `GET /write/chunks/{chunk_id}/versions`
- autosave continuo: `PATCH /write/chunks/{chunk_id}/autosave` com `client_version`
- em `409`, recarregar estado do chunk e reconciliar antes de novo autosave

## 6) Resumos

Fluxo recomendado:

1. apos lote de insercoes, chamar `POST /write/sections/{id}/summarize`
2. em seguida `POST /write/projects/{id}/summarize`
3. sincronizar `GET` de resumo quando necessario

## 7) Evitar conflitos basicos

- usar sempre resposta do backend como fonte da verdade para chunk_order e version;
- apos patch de secao/projeto, substituir estado local pelo payload retornado;
- para multi-aba, fazer refresh antes de continuar escrita com IA;
- evitar merge cego de metadata (controlar `metadata_replace` no patch do projeto).

## 8) Lacunas atuais

- sem controle otimista de versao por secao/chunk;
- sem endpoint de batch para multiplas secoes;
- sem notificacao realtime de alteracoes remotas.
