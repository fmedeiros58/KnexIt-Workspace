# Reindexacao Pos-Edicao

Data: 2026-03-03
Escopo: manter indice vetorial alinhado ao texto vigente dos chunks no Modo Escrita.

## 1) Estrategia escolhida

Estrategia adotada:

- 1 embedding ativo por chunk atual;
- `upsert` de embedding sempre aponta para o conteudo mais recente do chunk;
- historico de versoes permanece separado em `draft_chunk_versions` e nao participa da busca vetorial ativa por padrao.

## 2) Relacao entre edicao e embedding

- edicao manual (`PATCH /write/chunks/{id}`) pode reindexar imediatamente via `update_embedding=true`.
- autosave (`PATCH /write/chunks/{id}/autosave`) pode reindexar via `reindex_embedding=true`.
- reindexacao explicita manual disponivel via rotas de reindex.

## 3) Quando a reindexacao ocorre

1. Automaticamente (controlado por flag):
- patch de chunk
- autosave de chunk

2. Manual/disparavel:
- `POST /write/chunks/{id}/reindex`
- `POST /write/sections/{id}/reindex`
- `POST /write/projects/{id}/reindex`

## 4) Impacto no retrieval

- retrieval do write usa embedding atual do chunk;
- como a tabela de embeddings e 1:1 com chunk, nao ha duplicacao ativa por versao;
- evita contaminacao da busca por snapshot historico, salvo evolucao futura explicita.

## 5) Falhas e interpretacao

- falhas de alvo inexistente retornam `404`;
- falhas de processamento sao auditadas por `trace_id` nos eventos de servico;
- resposta de reindex informa escopo, quantidade reindexada e modelo de embedding.

## 6) Reproducao em outro ambiente

1. criar projeto/secao/chunk.
2. editar chunk com `update_embedding=false` (simular estado pendente).
3. chamar `POST /write/chunks/{chunk_id}/reindex`.
4. validar retorno com `reindexed_count=1`.
5. opcional: reindex de secao/projeto para conferencia em lote.

## 7) Limitacoes atuais

1. sem fila assíncrona para reindex em grande volume;
2. sem retry policy dedicada;
3. sem indexacao de embeddings por versao historica (somente estado atual).
