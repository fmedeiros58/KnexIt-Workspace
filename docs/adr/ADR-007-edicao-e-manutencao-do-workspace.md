# ADR-007: Edicao e Manutencao do Workspace de Escrita

Data: 2026-03-03
Status: Aceito

## Contexto

Escrita longa exige alteracoes continuas no texto. Sem edicao versionada, autosave, reindexacao e re-sumarizacao, o sistema perde coerencia entre:
- texto vigente;
- retrieval vetorial;
- resumos usados no contexto;
- memoria de processo usada no continue writing.

## Decisoes

1. Edicao com versionamento auditavel
- `draft_chunks` como estado atual;
- `draft_chunk_versions` como historico imutavel.

2. Autosave com controle de versao
- `PATCH /write/chunks/{id}/autosave` com `client_version`;
- conflito simples tratado com `409`.

3. Reindexacao obrigatoria apos mudanca de texto
- embeddings ativos seguem o estado atual do chunk;
- reindexacao por patch/autosave (flags) e por endpoints explicitos.

4. Re-sumarizacao obrigatoria apos mudanca relevante
- stale detection em summaries por secao/projeto;
- re-sumarizacao explicita por secao/projeto e por chunk (`/write/chunks/{id}/resummarize`).

5. Consolidacao minima de memoria de processo
- deduplicacao simples;
- desativacao auditavel (sem exclusao silenciosa);
- priorizacao por relevancia/recencia/uso.

6. Rotinas operacionais leves
- scripts cron-friendly para reindex, resummarize, consolidacao e consistency.

## Trade-offs

- ganho de previsibilidade e rastreabilidade com custo de mais chamadas explicitas;
- manutencao sincrona simples (sem fila pesada) pode aumentar tempo em lotes grandes;
- score de priorizacao de memoria e heuristico nesta versao.

## Riscos

- backlog operacional se jobs nao forem executados com frequencia;
- falso positivo em consolidacao de memoria com threshold muito agressivo;
- diferencas de ambiente se `WRITE_API_BASE_URL` ou state file forem mal configurados.

## Impactos futuros

- base pronta para automacao de agenda (cron/timer) sem refatoracao estrutural;
- prepara evolucao para observabilidade e retries mais sofisticados;
- prepara fluxo futuro de coedicao sem perder auditabilidade atual.
