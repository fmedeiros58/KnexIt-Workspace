# Integracao Frontend: Autosave e Edicao no Write

Data: 2026-03-03
Escopo: orientacao de integracao para editor com autosave e controle de versao.

## 1) Estado minimo no frontend

Por chunk em edicao:
- `chunkId`
- `content`
- `serverVersion` (ultima versao confirmada)
- `isDirty`
- `isSaving`
- `lastSaveAt`
- `lastError`

Por tela/projeto:
- `projectId`
- `sectionIdAtual`
- resumos carregados
- flags de stale

## 2) Fluxo recomendado de edicao

1. carregar chunk atual (`GET /write/chunks/{id}`);
2. editar localmente;
3. disparar autosave periodico/event-driven com `client_version=serverVersion`;
4. em sucesso, atualizar `serverVersion` com `server_version` retornado;
5. em `409`, parar autosave, recarregar chunk e resolver conflito basico no UI.

## 3) Quando chamar autosave

Eventos sugeridos:
- intervalo curto (ex.: 8-20s)
- blur do editor
- troca de secao/chunk

Endpoint:
- `PATCH /write/chunks/{id}/autosave`

Payload minimo:
- `content`
- `client_version`
- `autosave_reason`

## 4) Como lidar com conflito simples

Quando receber `409`:
1. exibir aviso de versao desatualizada;
2. buscar estado atual no backend (`GET /write/chunks/{id}`);
3. oferecer reconciliacao local vs servidor (manual na UI);
4. reenviar autosave/patch com versao atualizada.

## 5) Quando reconsultar backend

Reconsultar apos:
- conflito de autosave;
- patch de chunk concluido;
- reindexacao manual;
- re-sumarizacao;
- consolidacao de memoria se a tela exibir painel de memoria.

## 6) Paginas no editor

O workspace de escrita agora possui visao por paginas no painel de navegacao:
- aba `Paginas` mostra miniaturas (thumbnails) com a mesma proporcao da pagina em escala reduzida;
- clique em pagina faz scroll para o ponto correspondente;
- pagina ativa atualiza conforme scroll.

A paginacao e visual/navegacional e nao altera o contrato de persistencia dos chunks.
