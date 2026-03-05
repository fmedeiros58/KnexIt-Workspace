# Consolidacao de Memoria de Processo

Data: 2026-03-03
Escopo: camada minima de poda leve, deduplicacao simples e priorizacao para `process_memory` no Modo Escrita.

## 1) Estrategia adotada

A implementacao usa estado explicito e nao destrutivo:

- `is_active` para separar memoria ativa/inativa;
- `use_count` e `last_used_at` para recencia de uso;
- `deactivated_at` e `deactivation_reason` para trilha de poda;
- `consolidated_into_memory_id` para rastrear deduplicacao por merge logico.

Nenhum item e apagado automaticamente na consolidacao atual.

## 2) Priorizacao no /write/continue

O retrieval de memoria no fluxo de continuidade considera apenas itens ativos do projeto/escopo de secao e ranqueia por score composto:

- similaridade vetorial (peso principal);
- prioridade (`priority`);
- recencia (`last_used_at` ou `updated_at`);
- frequencia de uso (`use_count`);
- peso por tipo (`constraint`, `decision`, `terminology`, etc).

Apos selecionadas, as memorias usadas recebem `mark_process_memory_used` (incrementa `use_count` e atualiza `last_used_at`).

## 3) Consolidacao deduplicada

Endpoint: `POST /write/projects/{project_id}/memory/consolidate`

Regras atuais:
1. considera apenas memorias ativas;
2. agrupa candidatas por:
- chave normalizada (tipo + titulo + conteudo), ou
- similaridade vetorial acima de `similarity_threshold`;
3. escolhe primaria por prioridade/uso/recencia;
4. desativa duplicatas com:
- `is_active=false`
- `deactivation_reason=deduplicated_into:{memory_id}`
- `consolidated_into_memory_id` apontando para primaria.

## 4) Poda leve por TTL

No mesmo endpoint, quando `ttl_days > 0`:

- memorias ativas com `priority <= low_priority_max`,
- `use_count == 0`,
- e sem uso/atualizacao recente,

podem ser desativadas com `deactivation_reason=ttl_inactive:{ttl}d`.

## 5) Reproducao em outro ambiente

1. criar projeto e adicionar memorias repetidas;
2. executar `POST /write/projects/{id}/memory/consolidate` com `dry_run=true`;
3. repetir com `dry_run=false`;
4. consultar `GET /write/projects/{id}/memory` e `GET /write/projects/{id}/memory/inactive`;
5. reativar item com `PATCH /write/memory/{id}` se necessario.

## 6) Limitacoes atuais

1. Sem clusterizacao semantica avancada.
2. Sem fila assincrona para projetos muito grandes.
3. Sem exclusao fisica automatica (somente desativacao auditavel).
4. Consolidacao em lote por secao/projeto alem do endpoint atual nao foi adicionada nesta versao.

