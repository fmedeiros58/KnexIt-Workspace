# Autosave Modo Escrita

Data: 2026-03-03
Escopo: base de autosave e sincronizacao para editor continuo no dominio `/write/*`.

## 1) Estrategia escolhida

Estrategia adotada:

- endpoint dedicado `PATCH /write/chunks/{chunk_id}/autosave`;
- controle de concorrencia simples por `client_version`;
- autosave grava nova versao apenas quando o conteudo mudou.

Essa estrategia evita sobrescrita cega sem introduzir colaboracao multiusuario complexa.

## 2) Quando o frontend deve salvar

Fluxo recomendado no frontend:

1. autosave por intervalo (ex.: 5s a 15s) enquanto houver alteracoes locais;
2. autosave em eventos de foco (`blur`), troca de secao e antes de sair da tela;
3. autosave somente quando `content` local diferir do ultimo estado confirmado.

## 3) Deteccao de conflito simples

Conflito e detectado quando:

- `client_version` enviado nao bate com a versao atual do servidor para o chunk.

Comportamento:

- backend responde `409` com payload claro (`client_version`, `server_version`, `server_updated_at`);
- nenhuma sobrescrita e feita no servidor nessa situacao.

## 4) O que o backend retorna

### Caso salvo

- `status: "saved"`
- `server_version` atualizado
- `server_updated_at`
- `chunk` atual
- `version_record` da nova versao
- `reindex_applied` (se houve reindex de embedding)

### Caso sem mudanca

- `status: "no_change"`
- mesma versao do servidor
- sem nova versao criada

### Caso conflito

- HTTP `409` com erro `write_chunk_version_conflict`

## 5) Relacao com versionamento

- autosave usa a base de versionamento existente;
- cada autosave com mudanca cria novo snapshot em historico de versoes;
- autosave sem mudanca nao cria snapshot.

## 6) Limitacoes da versao atual

1. Nao e coedicao em tempo real.
2. Nao ha websocket nem reconciliacao colaborativa.
3. Sem lock otimista multiusuário completo (ha apenas controle simples por versao do chunk).
4. Runtime write atual ainda in-memory.

## 7) Reproducao em outro ambiente

1. subir backend com rotas `/write/*`.
2. criar projeto, secao e chunk.
3. chamar `PATCH /write/chunks/{chunk_id}/autosave` com `client_version` correto.
4. repetir chamada com mesma versao antiga para validar retorno `409`.
5. validar historico em `GET /write/chunks/{chunk_id}/versions`.
