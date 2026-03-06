# Resumos do Modo Escrita (Secao + Estado Global)

Data: 2026-03-03  
Escopo: camada de resumos incrementais e auditaveis para continuidade de escrita longa.

## 1) Objetivo operacional

A camada de resumos do Modo Escrita foi adicionada para reduzir dependencia de contexto bruto extenso e tornar a continuidade de escrita mais previsivel.

A estrategia atual separa dois niveis:

- **Resumo por secao** (`section_summaries`): estado vivo de cada secao.
- **Resumo global do projeto** (`project_global_summaries`): panorama consolidado do manuscrito.

## 2) Papel dos resumos por secao

`section_summaries` guarda uma visao sintetica da secao com:

- versao de resumo (`summary_version`);
- quantos chunks foram considerados (`source_chunk_count`);
- ultimo chunk processado (`last_chunk_id_processed`).

Isso permite saber objetivamente se uma secao foi reprocessada e contra qual base de chunks.

## 3) Papel do resumo global

`project_global_summaries` guarda uma consolidacao do projeto inteiro:

- versao de resumo global;
- total de chunks de origem considerados no calculo global.

O resumo global usa os resumos por secao como entrada preferencial e fallback simples para conteudo de secao quando ainda nao houver resumo local.

## 4) Quando os resumos sao atualizados

Atualizacao e **explicita** (nao automatica e nao oculta):

1. atualizar secao:
- `POST /write/sections/{section_id}/summarize`

2. atualizar global:
- `POST /write/projects/{project_id}/summarize`

Fluxo recomendado:

1. inserir/gerar novos `draft_chunks`;
2. recalcular resumo da secao afetada;
3. recalcular resumo global do projeto.

## 5) Como o versionamento funciona

Cada resumo tem `summary_version` e retorno explicito `updated`:

- `updated=true`: houve mudanca material no resumo (conteudo ou contadores) e a versao sobe.
- `updated=false`: recalculo executado, mas sem mudanca material; versao permanece.

Esse comportamento evita atualizacao silenciosa/opaca.

## 6) Como melhora coerencia

A camada melhora coerencia por:

- estabilizar estado por secao em texto curto e rastreavel;
- consolidar estado global sem carregar todo historico bruto;
- permitir refresh incremental por evento de escrita.

## 7) Mecanismo da versao atual

- fluxo sincrono e centralizado em `WriteSummaryService`;
- estrategia deterministica em `DeterministicWriteSummarizer`;
- sem fila/queue nesta etapa;
- sem heuristica escondida em hooks.

## 8) Limites conhecidos (intencionais)

- resumo ainda e textual deterministico simples (nao semantico por modelo nesta etapa);
- nao existe historico completo de snapshots por versao (mantem apenas estado ativo por secao/projeto);
- nao existe agendamento automatico por evento de chunk (chamada continua explicita por rota).

## 9) Como reproduzir em outro ambiente

1. aplicar migrations:
- `supabase/migrations/20260303142000_create_writing_summaries_schema.sql`

2. subir backend ANM com as rotas `/write/*`.

3. fluxo minimo:
- criar projeto;
- criar secao;
- inserir chunks;
- chamar `POST /write/sections/{section_id}/summarize`;
- chamar `POST /write/projects/{project_id}/summarize`;
- consultar `GET /write/sections/{section_id}/summary` e `GET /write/projects/{project_id}/summary`.

