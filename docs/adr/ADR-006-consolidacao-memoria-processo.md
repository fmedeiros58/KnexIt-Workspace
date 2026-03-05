# ADR-006: Consolidacao de Memoria de Processo no Modo Escrita

Data: 2026-03-03
Status: Aceito

## Contexto

Com o Modo Escrita ativo, `process_memory` passa a crescer conforme decisoes, regras e terminologia sao registradas durante a producao longa. Sem consolidacao minima, o retrieval tende a trazer redundancia, reduzir foco contextual e aumentar custo de inferencia.

Era necessario introduzir uma camada inicial de controle sem adicionar complexidade de IA autonoma pesada.

## Decisao

Adotar consolidacao minima, explicita e auditavel com:

1. desativacao logica (`is_active`) em vez de exclusao fisica;
2. deduplicacao simples por chave normalizada e similaridade vetorial;
3. priorizacao por score composto (similaridade, prioridade, recencia e uso);
4. rastreabilidade de consolidacao via `consolidated_into_memory_id` e `deactivation_reason`;
5. trilha de uso por `use_count` e `last_used_at` atualizada no `/write/continue`.

## Implementacao associada

- Migration: `20260303170000_add_process_memory_consolidation_fields.sql`
- Rollback: `20260303170000_drop_process_memory_consolidation_fields.sql`
- Rotas:
  - `POST /write/projects/{project_id}/memory/consolidate`
  - `GET /write/projects/{project_id}/memory`
  - `GET /write/projects/{project_id}/memory/inactive`
  - `PATCH /write/memory/{memory_id}`

## Consequencias

Positivas:
- menor redundancia no contexto de escrita;
- prioridade mais util para `continue writing`;
- poda controlada com trilha auditavel;
- sem perda silenciosa.

Negativas/trade-offs:
- score de priorizacao ainda heuristico;
- consolidacao ainda sincrona;
- sem clusterizacao semantica avancada.

## Alternativas consideradas

1. Exclusao definitiva de memorias duplicadas.
- Rejeitada por perda de auditabilidade.

2. Clusterizacao autonoma com pipeline complexo.
- Rejeitada nesta etapa por aumentar acoplamento e opacidade.

3. Nao consolidar nesta etapa.
- Rejeitada por risco de degradacao de retrieval no curto prazo.

## Riscos e mitigacoes

Risco: falso positivo de deduplicacao.
Mitigacao: `dry_run`, threshold configuravel e desativacao reversivel via patch.

Risco: memoria importante ser desativada por TTL leve.
Mitigacao: regra depende de baixa prioridade + sem uso + janela temporal; reativacao manual disponivel.

## Evolucao futura

1. consolidacao em lote assincrona com retry;
2. metricas de qualidade de memoria por projeto;
3. score ajustavel por dominio/tipo de escrita.

