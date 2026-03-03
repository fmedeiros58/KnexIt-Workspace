# Bootstrap do Modo Escrita (Etapa 3)

## Objetivo da etapa
Esta etapa criou a fundação arquitetural do domínio de escrita longa sem misturar o fluxo com o chat comum.  
O foco foi separar responsabilidades, manter auditabilidade e preparar pontos de extensão para memória de processo, anti-redundância e integração RAG.

## Como o Modo Escrita foi acoplado ao sistema
- Foi criado um domínio dedicado em `anm_backend/write/`.
- Foi criado um serviço dedicado em `anm_backend/services/write_service.py`.
- Foi criada uma superfície HTTP dedicada em `anm_backend/api/routes_write.py` com prefixo `/write`.
- O bootstrap de runtime em `anm_backend/main.py` passou a instanciar e registrar:
  - `write_repository` (implementação in-memory de bootstrap);
  - `write_service`;
  - router `/write`.

## Como ele se separa do chat comum
- O chat comum permanece em `anm_backend/api/routes_chat.py` usando `CognitiveService`.
- O modo escrita usa exclusivamente `WriteService` em `anm_backend/api/routes_write.py`.
- Não foi reutilizada rota `/chat` para operações de escrita.
- Não houve acoplamento de DTOs de chat com DTOs de escrita.
- O endpoint de escrita assistida é `/write/projects/{project_id}/assist` e não altera o contrato de `/chat`.

## Módulos e arquivos criados
- `anm_backend/write/__init__.py`
- `anm_backend/write/contracts.py`
- `anm_backend/write/repository.py`
- `anm_backend/services/write_service.py`
- `anm_backend/api/routes_write.py`

## Arquivos alterados
- `anm_backend/main.py` (registro de `write_service` e router `/write`)
- `anm_backend/api/schemas.py` (DTOs/validação do domínio de escrita)

## Dependências reaproveitadas da Etapa 2
- Cliente LLM interno já existente (`LLMAdapter`) para escrita assistida.
- Configuração por variáveis de ambiente (`ANM_WRITE_MAX_TOKENS`, `ANM_WRITE_CONTEXT_LIMIT` com defaults).
- Logging/auditoria estruturada via `audit_log`.
- Estrutura de validação já usada no backend via Pydantic (`api/schemas.py`).
- Contexto cognitivo/memória existente via `MemoryManager.assemble_prompt_context()`.
- Preparação para acoplamento com base vetorial/RAG por meio de referências de documento no projeto de escrita (`/write/projects/{id}/references`).

## Decisões estruturais adotadas
- Separação por domínio: `write/` concentra contratos e persistência de escrita.
- Serviço dedicado: `WriteService` encapsula regras de escrita, sem infiltrar lógica em rotas.
- Repositório dedicado: interface explícita (`WriteWorkspaceRepository`) com implementação de bootstrap (`InMemoryWriteWorkspaceRepository`) para evolução segura para adapter Postgres/pgvector.
- Contratos HTTP separados para escrita no mesmo padrão de DTOs do backend.
- Inclusão de endpoint de memória de processo (`/write/projects/{id}/memory`) para suportar próximas subetapas.

## Riscos de acoplamento indevido
- Repositório atual in-memory não é durável; persistência real deve migrar para adapter Postgres.
- Referências RAG já são vinculáveis, mas recuperação vetorial ainda é etapa seguinte.
- A escrita assistida já usa LLM interno, porém anti-redundância e sumarização incremental ainda não foram implementadas nesta etapa.
- Sem controle transacional cross-service nesta fase (esperado para bootstrap).

## Endpoints `/write/*` adicionados
- `GET /write/projects`
- `POST /write/projects`
- `GET /write/projects/{project_id}`
- `POST /write/projects/{project_id}/sections`
- `POST /write/projects/{project_id}/references`
- `POST /write/projects/{project_id}/assist`
- `GET /write/projects/{project_id}/memory`

## Próximos pontos para completar nas próximas subetapas
- Adapter Postgres/pgvector para `WriteWorkspaceRepository`.
- Pipeline de recuperação RAG por projeto/seção com re-ranking e janelas de contexto.
- Sumarização incremental por seção/chunk e memória de processo persistente.
- Mecanismo de anti-redundância e rastreio de trechos já gerados.
- Estratégias de checkpoint/versionamento de documento longo.
