# Anti-redundancia no Modo Escrita

Data: 2026-03-03  
Escopo: nucleo de continuidade de escrita com recuperacao semantica em multiplas camadas.

## 1) Objetivo

O fluxo `POST /write/continue` foi implementado para gerar **somente o proximo bloco** do manuscrito, com contexto auditavel e regras explicitas de anti-redundancia.

Ele reduz repeticao e contradicao ao combinar:

- chunks ja escritos semanticamente similares;
- memoria de processo relevante (regras, decisoes, terminologia);
- resumo da secao alvo;
- resumo global do projeto;
- objetivo/outline/status da secao em foco.

## 2) Camadas de retrieval

A recuperacao ocorre em camadas sequenciais:

1. **Chunks similares (`draft_chunks`)**
- consulta top-k por similaridade vetorial;
- objetivo: detectar o que ja foi dito e reduzir repeticao.

2. **Memoria de processo (`process_memory`)**
- consulta top-k por similaridade + prioridade;
- objetivo: manter coerencia com decisoes e restricoes editoriais.

3. **Resumos vivos**
- secao (`section_summaries`);
- global (`project_global_summaries`);
- objetivo: manter continuidade sem carregar contexto bruto gigante.

4. **Objetivo da secao alvo**
- `objective`, `outline_notes`, `status` da secao;
- objetivo: orientar explicitamente o que falta escrever.

## 3) Regras anti-redundancia no prompt

As regras sao montadas de forma centralizada em `anm_backend/write/continue_prompt_builder.py` e incluem, no minimo:

- nao repetir trechos ja cobertos;
- se tema ja apareceu, avancar/aprofundar (sem reexplicar);
- manter terminologia e decisoes registradas;
- respeitar objetivo e status da secao;
- gerar apenas o proximo bloco.

## 4) Persistencia do bloco novo

Apos gerar o texto:

1. salva em `draft_chunks` (camada repository);
2. gera embedding do novo chunk;
3. persiste embedding em `draft_chunk_embeddings` (adapter atual em memoria, contrato pronto para Postgres);
4. retorna ids de chunks/memorias usados para rastreabilidade.

## 5) Auditabilidade

Eventos estruturados de auditoria:

- `write_continue_generated` (service `write_continue_service`), contendo:
- `project_id`, `section_id`, `chunk_id`;
- ids recuperados (`retrieved_chunk_ids`, `retrieved_memory_ids`);
- ids de resumos usados;
- parametros de retrieval e geracao.

## 6) Parametros configuraveis

No endpoint:

- `top_k_chunks`;
- `top_k_memories`;
- `min_paragraphs`, `max_paragraphs`;
- `max_tokens`;
- `temperature`.

No ambiente:

- `EMBEDDING_DIMENSION`;
- `ANM_WRITE_EMBEDDING_MODEL`;
- `ANM_WRITE_CONTINUE_MAX_TOKENS`.

## 7) Limites conhecidos

- adaptador atual usa repositrio em memoria (nao duravel);
- embedding atual e deterministico por hash (baseline auditavel), inferior a embedding semantico neural dedicado;
- nao ha edicao/rewrite automatica de blocos anteriores nesta etapa;
- resumo nao e atualizado automaticamente apos `/write/continue` (atualizacao continua explicita pelos endpoints de resumo).

## 8) Evolucoes futuras

- plugar repositrio Postgres/pgvector preservando os mesmos contratos;
- usar embedding neural real para retrieval de maior precisao;
- adicionar politicas de threshold semantico por tipo de secao;
- implementar etapa de revisao/edicao controlada (fora desta entrega).

