# Implementation Spec V2

## 1. Visao geral MVP executavel
- A ANM roda em processo local Python.
- O centro cognitivo e o [`RamCortex`](../memory/ram_cortex.py) em RAM.
- Persistencia local (`./anm_backend/data/checkpoints`) existe apenas para continuidade operacional.
- O motor LLM continua externo e ja existente; a camada `adapters/` apenas integra.

## 2. Mapa das camadas
- `memory/`: estado vivo, regulacao curta, politicas, forgetting, checkpoint.
- `anm/`: neuronio/sinapse/plasticidade local e prontidao plastica local.
- `orchestrator/`: ressonancia, roteamento, hipoteses, colapso, mielinizacao e gate contextual.
- `adapters/`: prompt + chamada do motor + parse de resposta.
- `services/`: fluxo cognitivo fim-a-fim desacoplado da API.
- `api/`: endpoints FastAPI com schemas tipados.

## 3. Fluxo executavel implementado
1. `/chat` recebe `message`.
2. `CognitiveService` ingere observacao no `MemoryManager`.
3. `RegulatoryState` atualiza variaveis de curto prazo.
4. `PlasticityReadiness` calcula `readiness_score` e `readiness_state`.
5. `ContextualPlasticityGate` gera taxas efetivas:
- learning: `base_learning_rate * readiness_score`
- pruning: `base_pruning_rate * (1.0 - readiness_score)`
- consolidacao: `base_consolidation_rate * readiness_score`
- limite de profundidade de ressonancia
- retencao de hipoteses
6. `ResonanceEngine` propaga sinais com limites de ciclo/profundidade e gera hipoteses.
7. `CollapseEngine` colapsa candidatas.
8. `LLMAdapter` monta prompt, invoca `EngineClient`, parseia resposta.
9. Resposta entra de volta como observacao e reforco/consolidacao passa pelo gate.

## 4. Responsividade plastica computacional
- Implementada em:
- [`anm/plasticity_readiness.py`](../anm/plasticity_readiness.py)
- [`orchestrator/contextual_plasticity_gate.py`](../orchestrator/contextual_plasticity_gate.py)
- [`memory/regulatory_state.py`](../memory/regulatory_state.py)
- Distincao obrigatoria:
- `PlasticityReadiness`: prontidao para adaptar.
- `PlasticityEngine`: alteracao estrutural (peso, prioridade, custo).

## 5. Regra de seguranca obrigatoria
- Se `stress_load >= 0.78` e `context_stability <= 0.32`, consolidacao estrutural e bloqueada.
- O sistema pode processar e ativar sem consolidar mudanca estrutural.

## 6. Boot local
- Arquivo: [`main.py`](../main.py)
- Inicializa explicitamente:
- `RamCortex`, `RegulatoryState`, `MemoryManager`, `PlasticityReadiness`,
  `ContextualPlasticityGate`, registries, ressonancia, adaptadores e servico cognitivo.

## 7. Restore de checkpoint
- Salvar: `POST /memory/checkpoint`
- Restaurar: `POST /memory/restore` ou `POST /admin/restore`
- Conteudo inclui:
- memoria RAM serializada
- estado regulatorio
- historico resumido de readiness

## 8. Heuristicas provisórias (MVP)
- Pesos de readiness sao heuristicas iniciais.
- STDP simplificado.
- Permanencia de hipoteses por score+coherence+readiness.

## 9. TODOs tecnicos relevantes
- `ADP-001`: ampliar `EngineClient.invoke()` para perfis de providers nao OpenAI-compat.

## 10. Acoplamento real do motor
- O binding real esta em [`adapters/engine_client.py`](../adapters/engine_client.py).
- Fluxo:
1. `LLMAdapter` cria `EngineRequest`.
2. `EngineClient.engine_request_to_payload()` converte para payload HTTP real.
3. `EngineClient.invoke()` chama `POST {ANM_ENGINE_BASE_URL}/chat/completions`.
4. Resposta real do motor e parseada para `EngineResponse`.
- Healthcheck real:
1. `EngineClient.health()` tenta `GET {base_url}/models`.
2. Se falhar, executa probe minimo via `invoke()` com prompt curto.
3. Retorna `ok`, `latency_ms`, `model`, `error`.
- Variaveis de ambiente usadas:
- `ANM_ENGINE_BASE_URL`
- `ANM_ENGINE_MODEL`
- `ANM_ENGINE_API_KEY`
- `ANM_ENGINE_TIMEOUT_S`
- `ANM_CHAT_MAX_TOKENS`
- `ANM_ENGINE_USE_SYSTEM_ROLE` (compatibilidade de formato de mensagens)
