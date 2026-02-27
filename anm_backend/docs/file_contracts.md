# File Contracts V2

## memory/
| Arquivo | Responsabilidade | Entradas | Saidas | Estado alterado | Dependencias | Risco principal | Pontos de auditoria |
|---|---|---|---|---|---|---|---|
| `memory/ram_cortex.py` | Centro cognitivo em RAM | Observacoes, sinais, hipoteses | Snapshot/estado atual | contexto, ativacoes, trilhas, hipoteses | `contracts`, `audit` | Corrupcao concorrente | `activation_received`, `hypothesis_*` |
| `memory/memory_manager.py` | Orquestrar ciclo de memoria | observacoes, gate decision | contexto para prompt, snapshot | working/global/module/nodule/regulatorio | policies, forgetting, regulatory | Inconsistencia cross-layer | `ingest_observation`, `memory_consolidated` |
| `memory/memory_policies.py` | Politicas de retencao | salience, recurrence, objective_fit | scores/decisao | nao altera estado global | none | limiares inadequados | revisao de thresholds |
| `memory/forgetting_engine.py` | Poda de ruido | working memory | ids removidos | working memory | policies | poda excessiva | `item_forgotten` |
| `memory/checkpoint_manager.py` | save/load checkpoint local | snapshot, checkpoint_id | path/payload | filesystem | `json`, `pathlib` | arquivo corrompido | `checkpoint_saved`, `checkpoint_restored` |
| `memory/persistence_bridge.py` | ponte RAM<->checkpoint | checkpoint_id | bool/path | restore na memoria | memory_manager | restore incorreto | `checkpoint_saved/restored` |
| `memory/global_memory.py` | memoria global | namespace/key/value | export/read | namespaces globais | `audit` | drift sem governanca | `write`, `restore_state` |
| `memory/module_memory.py` | memoria por modulo | module_id/key/value | export/read | map de modulos | `audit` | vazamento entre modulos | `write`, `restore_state` |
| `memory/nodule_memory.py` | memoria por nodulo | nodule_id/key/value | export/read | map nodular | `audit` | crescimento nao controlado | `write`, `restore_state` |
| `memory/working_memory.py` | memoria de trabalho | WorkingItem | top/export | deque ativa | `collections` | saturacao RAM | `push`, `remove` |
| `memory/regulatory_state.py` | estado regulatorio de curto prazo | metricas de estimulo/feedback | snapshot/metrics | stress/stability/support/recovery | `contracts`, `audit` | bloqueio inadequado | `plasticity_readiness_updated` |

## anm/
| Arquivo | Responsabilidade | Entradas | Saidas | Estado alterado | Dependencias | Risco principal | Pontos de auditoria |
|---|---|---|---|---|---|---|---|
| `anm/neuron.py` | dinamica neuronal minima | estimulo | spike/ativacao | potencial/ativacao | none | thresholds ruins | teste unitario de firing |
| `anm/synapse.py` | transmissao de sinal | activation | influencia | peso/prioridade/custo (via plasticidade) | none | drift de peso | revisao de limites |
| `anm/plasticity.py` | atualizacao estrutural | pre/post/readiness | peso atualizado | synapse weight/priority/cost | `audit` | reforco de ruido | `synapse_*` eventos |
| `anm/plasticity_readiness.py` | prontidao plastica | metricas normalizadas | readiness snapshot | historico curto local | `contracts`, `audit` | heuristica nao calibrada | `plasticity_readiness_updated` |
| `anm/nodule.py` | microrede autonoma | input + metricas | output local | neuronios/sinapses/local_state | neuron/synapse/plasticity | consolidar ruido | `nodule_fired` |
| `anm/network.py` | catalogo de nodulos | register/connect | neighbors/get | maps de nodulos e relacoes | nodule | topologia desatualizada | inspeção debug |

## orchestrator/
| Arquivo | Responsabilidade | Entradas | Saidas | Estado alterado | Dependencias | Risco principal | Pontos de auditoria |
|---|---|---|---|---|---|---|---|
| `orchestrator/nodule_registry.py` | registrar/validar nodulos | nodule + capabilities | get/list | registro de nodulos | nodule | nodulo invalido | `nodule_registered` |
| `orchestrator/pathway_graph.py` | grafo de vias | upsert/get | outgoing/export | edges | `audit` | ids inconsistentes | `pathway_upserted` |
| `orchestrator/myelination_engine.py` | reforco/enfraquecimento/decay | feedback | none | peso/prioridade/custo/myelin | graph | overfitting de rota | `pathway_reinforced/weakened` |
| `orchestrator/router.py` | decisao de rotas | source + graph + cortex | `RouteDecision[]` | none | graph/cortex | viés determinista | auditoria de score |
| `orchestrator/scheduler.py` | ordenar tarefas | task+priority | next task | fila interna | heapq | starvation | testes de ordem |
| `orchestrator/hypothesis_pool.py` | superposicao e poda | hypothesis + readiness | top/active/export | mapa de hipoteses | `audit` | explosao de hipoteses | `hypothesis_*` |
| `orchestrator/collapse_engine.py` | colapsar hipoteses | candidates | hypothesis final | none | hypothesis_pool | colapso prematuro | `hypothesis_collapsed` |
| `orchestrator/contextual_plasticity_gate.py` | modular plasticidade/consolidacao | readiness + regulatory | decision rates | ultimo gate | regulatory | gate super restritivo | `contextual_plasticity_gate_applied` |
| `orchestrator/resonance_engine.py` | propagacao ressonante | seed+gate+metrics | hipoteses top | cortex/hypothesis trail | registry/router/scheduler | runaway propagation | `resonance_cycle` |

## adapters/
| Arquivo | Responsabilidade | Entradas | Saidas | Estado alterado | Dependencias | Risco principal | Pontos de auditoria |
|---|---|---|---|---|---|---|---|
| `adapters/engine_client.py` | invocacao do motor existente | EngineRequest/payload | raw response | none | urllib, env | indisponibilidade do motor | `engine_invoked` |
| `adapters/prompt_builder.py` | montagem de prompt | context+hypotheses | messages | none | hypothesis | prompt inflado | testes de montagem |
| `adapters/response_parser.py` | parse da resposta | raw payload | EngineResponse | none | contracts | parse silencioso | testes parser |
| `adapters/llm_adapter.py` | pipeline adapter | user_input/context | EngineResponse | none | builder/client/parser | acoplamento indevido | testes de integração fake |

## api/services/main
| Arquivo | Responsabilidade | Entradas | Saidas | Estado alterado | Dependencias | Risco principal | Pontos de auditoria |
|---|---|---|---|---|---|---|---|
| `services/cognitive_service.py` | fluxo cognitivo e2e | message | payload resposta | memoria+hipoteses+vias | all core modules | fluxo divergente da arquitetura | logs por trace |
| `api/routes_chat.py` | endpoint de chat | ChatRequest | ChatResponse | delega | cognitive_service | erro HTTP generico | validação schema |
| `api/routes_memory.py` | estado/snapshot | request body | estado/restore result | delega | memory_manager/persistence | restore indevido | auditoria de checkpoints |
| `api/routes_debug.py` | debug tecnico | request | estado tecnico | none | app.state | exposicao sensivel | feature-flag TODO |
| `api/routes_admin.py` | operacoes admin | request | status/reset/restore | reset controlado | persistence/memory | reset acidental | trilha administrativa |
| `main.py` | bootstrap runtime | env | app FastAPI | instancia componentes | todos modulos centrais | ordem de init | smoke de boot |
