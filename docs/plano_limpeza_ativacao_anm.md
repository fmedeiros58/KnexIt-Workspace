# Plano de Limpeza + Ativacao do ANM Backend (KnexAI)

## 1) Objetivo

Padronizar a arquitetura para um unico fluxo auditavel de IA, removendo codigo residual e ativando o `anm_backend` como camada de orquestracao sobre o motor (vLLM/Mistral), com comparacao A/B para validar ganho real.

## 2) Estado atual (baseline tecnico)

1. Runtime ativo hoje:
   - Next.js via `npm run dev` (porta `3000`).
   - vLLM ativo em `127.0.0.1:8000`.
   - `anm_backend` nao esta ativo em runtime.
2. Fluxo efetivo do chat:
   - UI: `knexai/web/page.tsx`.
   - Cliente: `knexai/lib/client.ts` chama `/api/knexai`.
   - API: `app/api/knexai/route.ts` chama vLLM direto.
3. `anm_backend` existe, mas esta desacoplado do fluxo Next atual.
4. Ha divergencia de nome logico de modelo (`mistral-awq`) versus modelo listado pelo servidor vLLM (id por path), o que gera tentativas/fallbacks desnecessarios.

## 3) Escopo da limpeza

### 3.1 Remocao imediata (baixo risco)

Arquivos vazios, sem consumidor:

- `lib/knexai/memory.ts`
- `lib/knexai/superposition.ts`

### 3.2 Quarentena antes de remocao (risco medio)

Arquivos com cara experimental/residual, sem import externo no fluxo atual:

- `lib/knexai/gates.ts`
- `lib/knexai/homeostasis.ts`
- `lib/knexai/modulators.ts`
- `lib/knexai/modulators.d.ts`
- `lib/knexai/myelin.ts`
- `lib/knexai/resonance.ts`
- `lib/knexai/mods/*`
- `lib/knexai/nodes/*`

E tambem o stub opcional de servidor local:

- `knexai/src/server.ts`
- `knexai/package.json`
- `knexai/package-lock.json`
- `knexai/README.md` (apenas se o conteudo ficar 100% refletido no README raiz)

## 4) Arquitetura alvo

### 4.1 Fluxo unico

`UI (/knexai/web)` -> `app/api/knexai` -> `anm_backend` -> `vLLM (/v1/chat/completions)`

### 4.2 Modo com feature flag

Adicionar chave de execucao para rollback instantaneo:

- `KNEXAI_ENGINE_MODE=direct|anm` (default inicial: `direct`)
- `ANM_BACKEND_BASE_URL=http://127.0.0.1:8100`
- `ANM_BACKEND_TIMEOUT_MS=45000`

Comportamento:

1. `direct`: fluxo atual (Next -> vLLM).
2. `anm`: Next chama `POST {ANM_BACKEND_BASE_URL}/chat`.
3. Fallback opcional: se ANM falhar (`5xx`/timeout), cair em `direct` por feature flag de seguranca.

## 5) Implementacao (ordem recomendada)

## Fase A - Preparacao e guardrails

1. Criar branch dedicada (`chore/knexai-cleanup-anm`).
2. Congelar estado com snapshot dos logs/latencia.
3. Atualizar README raiz removendo instrucoes obsoletas de backend `3700` como fluxo principal.

## Fase B - Integracao ANM no endpoint Next

1. Em `app/api/knexai/route.ts`, encapsular provider:
   - `provider=direct` (existente).
   - `provider=anm` (novo).
2. Implementar cliente ANM:
   - Request: `{ message: prompt }`.
   - Response esperada: `answer` (schema do ANM).
3. Manter contrato de retorno do front:
   - Se ANM nao for streaming, retornar `text/plain` com simulacao de chunks curtos (opcional) para nao quebrar UX.
4. Logar `trace_id` ANM no server Next para auditoria ponta-a-ponta.

## Fase C - Ativacao operacional do ANM

1. Adicionar script raiz para subir ANM no mesmo ambiente de dev (WSL):
   - Exemplo: `serve:anm` usando `uvicorn anm_backend.main:app --host 127.0.0.1 --port 8100`.
2. Validar saude:
   - `GET /healthz`
   - `GET /admin/health`
   - `GET /debug/state` (ambiente local)
3. Ajustar `ANM_ENGINE_*` para apontar ao vLLM existente.

## Fase D - Limpeza de codigo residual

1. Remover os 2 arquivos vazios (Fase 3.1).
2. Mover arquivos da Fase 3.2 para pasta de quarentena:
   - `archive/knexai-experimental/`
3. Rodar build/lint/testes.
4. Se nenhum consumidor reaparecer por 1 ciclo de release, remover definitivamente.

## Fase E - Benchmark A/B (criterio de melhoria)

1. Criar suite de prompts fixa (`bench/prompts_knexai.json`), com 3 grupos:
   - curto direto
   - medio contextual
   - complexo tecnico
2. Executar 30-50 requests por modo (`direct` vs `anm`) e medir:
   - `ttfb_ms` (tempo ate primeiro byte)
   - `total_ms`
   - taxa de erro
   - tamanho de resposta
3. Score de qualidade manual (rubrica 1-5):
   - corretude
   - aderencia ao prompt
   - coerencia
4. Criterio de aprovacao:
   - erro `anm` <= erro `direct`
   - qualidade media `anm` >= `direct`
   - latencia total p95 `anm` nao pior que `direct` em mais de 15%

## 6) Plano de auditoria

1. Padronizar `trace_id` em toda cadeia:
   - Next API loga `trace_id`.
   - ANM loga `trace_id`.
   - vLLM chamada inclui `trace_id` em metadata quando possivel.
2. Guardar evidencias por execucao:
   - data/hora
   - modo (`direct`/`anm`)
   - prompt hash
   - metricas de latencia
   - status final
3. Manter endpoint de health consolidado no Next:
   - `GET /api/knexai/health` incluir estado do provider atual.

## 7) Rollback

Rollback sem deploy de codigo:

1. Trocar `KNEXAI_ENGINE_MODE=direct`.
2. Reiniciar app Next.
3. Manter ANM desligado ate nova janela de teste.

## 8) Entregaveis finais

1. Codigo limpo sem arquivos vazios.
2. Fluxo unico documentado no README.
3. Feature flag de provider (`direct`/`anm`) ativa.
4. Scripts de subida local (`serve:vllm` + `serve:anm`).
5. Relatorio A/B com decisao de manter ou nao o ANM no caminho principal.

