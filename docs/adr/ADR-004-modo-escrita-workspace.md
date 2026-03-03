# ADR-004 - Modo Escrita como Workspace

- Status: Aceito
- Data: 2026-03-03
- Escopo: dominio /write/* para escrita longa com continuidade controlada

## Contexto

Chat comum e insuficiente para escrita longa porque:

- mistura historico de conversa com historico editorial;
- nao oferece estrutura por secoes com objetivo e outline;
- nao explicita memoria de processo editorial;
- dificulta continuidade sem redundancia em manuscritos extensos.

## Decisao

Criar dominio separado `/write/*` com:

- projetos de escrita;
- secoes estruturadas;
- chunks persistidos;
- memoria de processo;
- resumos de secao e resumo global;
- fluxo `/write/continue` com anti-redundancia.

## Decisoes-chave

1. Separacao de dominio
- `/write/*` nao usa endpoint de chat comum.

2. Memoria de processo explicita
- regras, decisoes e terminologia ficam em `process_memory` e entram no context pack de continuidade.

3. Resumos vivos
- secao e global sao atualizados por rotas explicitas de summarize.

4. Prompt assembly auditavel
- montagem de contexto do continue writing e centralizada e rastreavel.

## Trade-offs

- Pro: contrato claro para frontend, melhor continuidade, mais auditabilidade.
- Contra: mais endpoints e maior disciplina de sincronizacao no frontend.

## Riscos

- drift entre estado local do editor e backend sem politica de refresh;
- qualidade de retrieval limitada pelo embedding baseline atual;
- adapter in-memory nao atende durabilidade de producao.

## Impactos futuros

- plugar repositorio Postgres/pgvector mantendo contrato atual;
- adicionar controle de concorrencia (ex.: versionamento otimista);
- evoluir estrategia de embeddings sem quebrar API.
