# Pipeline Flags (RAG v2)

Data: 2026-03-04  
Objetivo: habilitar o pipeline v2 de forma incremental, mantendo o v1 intacto quando v2 estiver desligado.

## 1) Compatibilidade

- `PIPELINE_VERSION=v1` preserva o comportamento legada (v1) por padrao.
- O v2 pode ser habilitado globalmente por env ou por requisicao com:
  - body: `"pipeline": "v2"`
  - header: `X-Pipeline: v2`
- Rotas cobertas:
  - `POST /query`
  - `POST /api/query`
  - `POST /chat`
  - `POST /api/chat`
  - `POST /v1/chat/completions` (tambem via `extra_body.pipeline`)

## 2) Flags principais

- `PIPELINE_VERSION`:
  - valores: `v1` | `v2`
  - default: `v1`
- `RAG_HYBRID_ENABLED`:
  - combina retrieval vetorial + lexical no v2
  - default: `1`
- `RERANK_ENABLED`:
  - ativa rerank condicional no v2
  - default: `1`
- `CITATION_ALIGNMENT_ENABLED`:
  - alinha claims da resposta com evidencias recuperadas
  - default: `1`
- `WRITE_MODE_ENABLED`:
  - ativa writer pipeline multi-call para perguntas complexas
  - default: `1`
- `OCR_AUTO_ENABLED`:
  - liga fluxo de OCR automatico (estrutura preparada; OCR completo depende da etapa de raster+OCR)
  - default: `0`
- `RAG_MMR_ENABLED`:
  - ativa diversidade MMR no ranking final
  - default: `1`

## 3) Observabilidade e auditoria

- `RAG_RETRIEVAL_RUN_AUDIT_ENABLED`:
  - grava `rag_v2.retrieval_runs`
  - default: `1`
- `RAG_GENERATION_RUN_AUDIT_ENABLED`:
  - grava `rag_v2.generation_runs` e `rag_v2.citations`
  - default: `1`
- `RAG_QUERY_CACHE_ENABLED`:
  - cache in-memory de retrieval hibrido por hash de query
  - default: `1`

## 4) Recomendação operacional

- Rollout sugerido:
  1. `PIPELINE_VERSION=v1` com flags v2 default.
  2. smoke com `pipeline=v2` por request.
  3. habilitar `PIPELINE_VERSION=v2` para ambiente de homologacao.
  4. promover para producao apos benchmark de latencia/qualidade.

## 5) Exemplo de configuracao

```env
PIPELINE_VERSION=v1
RAG_HYBRID_ENABLED=1
RERANK_ENABLED=1
CITATION_ALIGNMENT_ENABLED=1
WRITE_MODE_ENABLED=1
OCR_AUTO_ENABLED=0
RAG_MMR_ENABLED=1
RAG_RETRIEVAL_RUN_AUDIT_ENABLED=1
RAG_GENERATION_RUN_AUDIT_ENABLED=1
RAG_QUERY_CACHE_ENABLED=1
```

