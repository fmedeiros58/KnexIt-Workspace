# API Resumarizacao Write

Data: 2026-03-03
Base path: /write

## 1) Endpoints

- `POST /write/chunks/{chunk_id}/resummarize`
- `POST /write/sections/{section_id}/summarize`
- `POST /write/projects/{project_id}/summarize`
- `GET /write/sections/{section_id}/summary`
- `GET /write/projects/{project_id}/summary`

## 2) Contrato de re-sumarizacao por chunk

### POST /write/chunks/{chunk_id}/resummarize

Sem payload.

Resposta (resumo):

```json
{
  "trace_id": "trace-...",
  "chunk_id": "wrc-...",
  "project_id": "wrp-...",
  "section_id": "wrs-...",
  "section_summary": {
    "summary_id": "wss-...",
    "summary_version": 3,
    "is_stale": false,
    "stale_reasons": []
  },
  "project_summary": {
    "summary_id": "wpg-...",
    "summary_version": 2,
    "is_stale": false,
    "stale_reasons": []
  }
}
```

Comportamento:
1. resolve chunk alvo;
2. recalcula resumo da secao do chunk;
3. recalcula resumo global do projeto;
4. retorna as duas visoes atualizadas.

## 3) Contrato de leitura de stale

### GET /write/sections/{section_id}/summary
Retorna resumo com `is_stale` e `stale_reasons`.

### GET /write/projects/{project_id}/summary
Retorna resumo global com `is_stale` e `stale_reasons`.

## 4) Erros comuns

- `404`: chunk/secao/projeto/resumo nao encontrado.
- `503`: dependencia de resumo indisponivel no runtime.

## 5) Uso recomendado no frontend

1. apos edicao importante de chunk, chamar `POST /write/chunks/{id}/resummarize`; ou
2. usar rotas separadas de secao e projeto quando o fluxo exigir controle fino;
3. usar `GET .../summary` para refletir badges de stale no editor.

