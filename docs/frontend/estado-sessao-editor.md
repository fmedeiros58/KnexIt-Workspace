# Estado Sessao Editor

Data: 2026-03-03  
Escopo: controle de sessao e estado ativo do Modo Escrever

## Estado minimo do workspace

Implementado em `knexai/web/page.tsx` como `writeSession: WriteEditorSessionState`:

- `editorSessionId`
- `activeProjectId`
- `activeSectionId`
- `activeMode` (`chat | write`)
- `loadedSections`
- `loadedChunks`
- `projectSummary`
- `sectionSummary`
- `currentInstruction`
- `isSaving`
- `isGenerating`
- `hasUnsavedChanges`
- `lastSyncedAt`
- `saveError`

## Como projeto e secao ativos sao controlados

- Entrada no modo escrita:
  - carrega lista de projetos (`GET /write/projects`);
  - seleciona projeto alvo;
  - carrega projeto e secoes (`GET /write/projects/{id}` + `GET /write/projects/{id}/sections`);
  - define `activeProjectId` e `activeSectionId`.
- Troca de projeto:
  - recarrega secoes/chunks/summaries do novo projeto.
- Troca de secao:
  - atualiza `activeSectionId`;
  - atualiza `loadedChunks`;
  - recarrega resumo da secao.

## Como inconsistencias de estado sao evitadas

- O estado ativo (projeto/secao) e centralizado em `writeSession`.
- A troca de secao atualiza explicitamente o editor e os chunks em memoria.
- `hasUnsavedChanges` e atualizado quando o editor recebe alteracao local.
- `saveError` e preenchido de forma explicita quando ocorre falha de carga/sincronizacao.

## Relacao com autosave e continue writing

- `currentInstruction` e `isGenerating` sustentam o fluxo de geracao (`POST /write/continue`).
- `loadedChunks` recebe o novo chunk retornado pelo backend de continue.
- `isSaving` e `lastSyncedAt` estruturam o estado para autosave/sync sem logica implicita.
- A base de estado ja suporta evolucao para autosave de chunk com versao (`PATCH /write/chunks/{id}/autosave`) sem mudar o contrato principal do workspace.

## Reproducao em outro ambiente

1. Configure `ANM_BACKEND_BASE_URL` no Next.
2. Suba backend com rotas `/write/*` habilitadas.
3. Suba frontend Next.
4. Abra a tela do KnexAI.
5. Alterne para `Escrever`.
6. Verifique:
   - carregamento de projetos/secoes;
   - atualizacao de `activeProjectId` e `activeSectionId`;
   - atualizacao de summaries e chunks;
   - mudanca de `hasUnsavedChanges` ao editar texto;
   - mudanca de `isGenerating` durante `/write/continue`.

## Limites desta versao

- Nao ha colaboracao em tempo real.
- Nao ha lock distribuido de secao.
- Nao ha persistencia de estado de sessao na URL.
- Autosave de chunk com conflito de versao permanece como etapa seguinte de UX integrada (base de estado ja preparada).
