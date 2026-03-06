# ADR-005 - Versionamento de Chunks no Modo Escrita

- Status: Aceito
- Data: 2026-03-03
- Escopo: edicao auditavel de chunks em `/write/*`

## Contexto

O Modo Escrita precisava permitir revisao de trechos sem sobrescrita irreversivel.

Problema observado:

- apenas mutacao simples de chunk nao preserva trilha historica;
- sem historico, auditoria e reproducao editorial ficam comprometidas;
- o frontend precisa consultar versao atual e historico sem reconstruir estado manualmente.

## Decisao

Adotar estrategia de duas camadas:

1. `draft_chunks` representa apenas o estado atual do chunk.
2. `draft_chunk_versions` registra snapshots imutaveis por versao.

Regras:

- cada edicao incrementa versao (`version_number`);
- cada snapshot aponta para `previous_version_id` quando houver;
- `edit_source` registra origem da alteracao (`user_edit`, `system_edit`, etc.).

## Justificativa tecnica

- leitura de estado atual permanece simples (consulta direta em chunk atual);
- historico fica rastreavel sem custo de reconstituicao de documento inteiro;
- baixo impacto no fluxo existente de retrieval e summaries;
- separa claramente operacao transacional (chunk atual) de auditoria (versoes).

## Trade-offs

Pros:

- edicao nao destrutiva;
- auditoria clara por versao;
- baixo acoplamento com o restante do dominio write.

Contras:

- aumento de armazenamento (snapshot por versao);
- necessidade de politica futura para retenção/compactacao;
- sem diff nativo nesta fase (apenas snapshots completos).

## Consequencias

1. Novos endpoints de chunk foram adicionados:
- `PATCH /write/chunks/{id}`
- `GET /write/chunks/{id}`
- `GET /write/chunks/{id}/versions`

2. Retrieval continua usando estado atual de chunk.
3. Resumos continuam explicitos (nao ha atualizacao implicita obrigatoria apos edit).
4. Evolucoes futuras podem incluir diff, autoria detalhada e controle otimista.

## Riscos aceitos

- concorrencia de edicao ainda sem lock otimista;
- runtime write atual ainda in-memory.

## Impacto futuro esperado

- migracao para repositorio persistente mantendo o mesmo contrato de API;
- habilitacao de autosave com a mesma base de versionamento;
- historico por autor/cliente sem quebrar modelo atual.
