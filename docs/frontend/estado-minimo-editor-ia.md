# Estado Minimo - Editor IA (Frontend)

Data: 2026-03-03

## 1) Estado minimo obrigatorio

- `projectId: string`
- `currentSectionId: string | null`
- `outlineLocal: Array<{ sectionId, title, order, status, objective, outlineNotes }>`
- `chunksBySection: Record<sectionId, Chunk[]>`
- `sectionSummaries: Record<sectionId, SectionSummary | null>`
- `projectSummary: ProjectSummary | null`
- `generationStatus: "idle" | "running" | "error"`
- `currentInstruction: string`

## 2) Estado recomendado adicional

- `lastContinueTraceId: string | null`
- `lastRetrievedChunkIds: string[]`
- `lastRetrievedMemoryIds: string[]`
- `syncStatus: "clean" | "dirty" | "syncing"`
- `lastSyncAt: string | null`

## 3) Pontos de sincronizacao com backend

1. Criacao de projeto -> salvar `projectId`.
2. Criacao/patch de secao -> atualizar `outlineLocal`.
3. Insert/continue -> atualizar `chunksBySection[currentSectionId]`.
4. Summarize secao -> atualizar `sectionSummaries[currentSectionId]`.
5. Summarize projeto -> atualizar `projectSummary`.
6. Reload de seguranca -> refazer `GET /write/projects/{id}/sections`.

## 4) Regra de fonte da verdade

Backend define:

- `chunk_order`
- `version`
- `summary_version`
- estado final de `status` de secao/projeto

Frontend nunca deve inferir esses valores sem reconciliar com resposta da API.

## 5) Limites atuais que impactam estado

- sem lock transacional de edicao concorrente;
- sem feed de alteracao em tempo real;
- sem versionamento otimista exposto na API.
