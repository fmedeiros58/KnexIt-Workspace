# Resumarizacao Pos-Edicao

Data: 2026-03-03
Escopo: manter `section_summaries` e `project_global_summaries` coerentes com o conteudo atual de `draft_chunks` apos edicao manual.

## 1) Relacao entre edicao e resumos

No Modo Escrita, o texto vigente fica em `draft_chunks` (estado atual do chunk). Sempre que esse estado muda, o resumo pode ficar defasado.

A implementacao atual trata isso de forma explicita:

- resumo por secao pode ser recalculado por endpoint dedicado;
- resumo global do projeto pode ser recalculado por endpoint dedicado;
- existe rota de atalho por chunk editado para recalcular secao + projeto em sequencia.

## 2) Quando a re-sumarizacao ocorre

Estrategia adotada: modo hibrido e previsivel.

1. Disparo explicito por endpoint:
- `POST /write/chunks/{chunk_id}/resummarize`
- `POST /write/sections/{section_id}/summarize`
- `POST /write/projects/{project_id}/summarize`

2. Disparo opcional por flags em fluxo de escrita/edicao:
- `POST /write/insert` com `summarize_section` e/ou `summarize_project`
- `PATCH /write/chunks/{chunk_id}` com `summarize_section` e/ou `summarize_project`

Nao existe pipeline oculto assincrono nesta versao.

## 3) Como detectar resumo desatualizado

As leituras de resumo (`GET /write/sections/{id}/summary` e `GET /write/projects/{id}/summary`) retornam:

- `is_stale` (boolean)
- `stale_reasons` (lista de motivos)

Motivos atuais de stale por secao:
- `missing_summary`
- `chunk_count_changed`
- `last_chunk_pointer_changed`
- `chunk_updated_after_summary`

Motivos atuais de stale global:
- `missing_summary`
- `project_chunk_count_changed`
- `chunk_updated_after_project_summary`
- `section_summary_missing:{section_id}`
- `section_summary_newer_than_project:{section_id}`

## 4) Versionamento e rastreabilidade

- `section_summaries.summary_version` aumenta quando o conteudo consolidado muda.
- `project_global_summaries.summary_version` aumenta quando o consolidado global muda.
- eventos auditados:
  - `write_section_summary_recalculated`
  - `write_project_global_summary_recalculated`
  - `write_chunk_resummarized`

## 5) Reproducao em outro ambiente

1. Criar projeto e secao.
2. Inserir chunks e gerar resumo de secao/projeto.
3. Editar chunk sem resumir automaticamente.
4. Consultar `GET .../summary` e validar `is_stale=true`.
5. Chamar `POST /write/chunks/{id}/resummarize`.
6. Reconsultar `GET .../summary` e validar `is_stale=false`.

## 6) Limitacoes atuais

1. Sem fila dedicada para resumarizacao em lote.
2. Sem resumo historico por versao de chunk (resume o estado vigente).
3. Sem heuristica avancada de custo/token para decidir quando resumir.

