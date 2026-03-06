# Continue Writing Flow (Write Mode)

Data: 2026-03-03  
Escopo: fluxo ponta-a-ponta da rota `POST /write/continue`.

## 1) Visao geral

Fluxo deterministico e centralizado:

1. identificar alvo de escrita;
2. recuperar o que ja foi dito (chunks similares);
3. recuperar o que deve ser mantido coerente (memoria + resumos);
4. recuperar o que falta escrever (objetivo/outline/status da secao);
5. montar context pack;
6. chamar LLM interno para proximo bloco;
7. persistir chunk + embedding.

## 2) Sequencia detalhada

### Etapa A - Alvo de escrita

Entrada:

- `project_id` (obrigatorio)
- `instruction`
- `section_id` (opcional)

Resolucao de secao:

- usa `section_id` quando fornecido;
- senao tenta inferir via hint textual (ex.: `secao 2.3`);
- fallback: primeira secao ativa por ordem.

### Etapa B - O que ja foi dito

- monta query de retrieval com instrucao + objetivo/outline da secao + resumos;
- busca top-k de chunks por similaridade vetorial;
- guarda ids e scores para auditoria.

### Etapa C - Coerencia obrigatoria

- busca top-k de `process_memory` (ativos) por similaridade + prioridade;
- le resumo da secao (`section_summaries`), quando existir;
- le resumo global (`project_global_summaries`), quando existir.

### Etapa D - O que falta escrever

- usa `objective`, `outline_notes`, `status` da secao alvo;
- isso vira parte explicita do context pack.

### Etapa E - Context pack final

Composicao centralizada em:

- `anm_backend/write/continue_prompt_builder.py`

Conteudo do pack:

- metadados de projeto/secao;
- objetivo da secao;
- resumo da secao;
- resumo global;
- memorias relevantes;
- chunks similares;
- regras anti-redundancia;
- janela de paragrafo esperada.

### Etapa F - Chamada ao LLM interno

- cliente reutilizado: `llm_adapter.engine_client`;
- gera somente o proximo bloco (nao o documento inteiro);
- janela controlada por `min_paragraphs` e `max_paragraphs`.

### Etapa G - Persistencia

- grava novo bloco em `draft_chunks`;
- grava embedding do bloco em `draft_chunk_embeddings`;
- retorno inclui ids de contexto usados para rastreabilidade.

## 3) Arquivos principais

- `anm_backend/services/write_continue_service.py`
- `anm_backend/write/continue_prompt_builder.py`
- `anm_backend/write/semantic_embeddings.py`
- `anm_backend/api/routes_write.py`
- `anm_backend/api/schemas.py`
- `anm_backend/write/repository.py`

## 4) Reproducao em outro ambiente

1. aplicar schema de escrita + resumos (etapas anteriores);
2. subir backend ANM;
3. criar projeto e secao;
4. inserir chunks e memoria de processo;
5. (opcional) atualizar resumos de secao/projeto;
6. chamar `POST /write/continue`.

## 5) Limites da versao atual

- repositrio atual e in-memory bootstrap;
- retrieval vetorial usa embedding deterministico por hash;
- sem pipeline de edicao/revisao de blocos antigos;
- sem auto-refresh de resumo apos gerar novo chunk.

