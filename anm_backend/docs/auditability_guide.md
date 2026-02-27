# Auditability Guide V2

## 1. Cabecalho tecnico obrigatorio
Todo arquivo central inicia com:
- `FILE`
- `RESPONSIBILITY`
- `FLOW ROLE`
- `READS`
- `RAM WRITES`
- `PERSISTS`
- `PRIMARY RISK`

## 2. Padrão de docstrings
- Classes publicas: objetivo, responsabilidades, limites, mutacoes, proibicoes.
- Funcoes/metodos publicos: proposito, parametros, retorno, efeitos, impacto RAM/persistencia, falhas esperadas.

## 3. Comentarios estruturados aceitos
- `OBS:`
- `DECISION:`
- `NOTE:`
- `INVARIANT:`
- `TODO(<ID>):`
- `FIXME(<ID>):`

## 4. Logs estruturados
Envelope padrao (ver [`audit.py`](../audit.py)):
- `timestamp`
- `trace_id`
- `component`
- `event`
- `payload`

Eventos criticos exigidos e implementados:
- `activation_received`
- `nodule_fired`
- `pathway_reinforced`
- `pathway_weakened`
- `hypothesis_created`
- `hypothesis_updated`
- `hypothesis_collapsed`
- `checkpoint_saved`
- `checkpoint_restored`
- `engine_invoked`
- `plasticity_readiness_updated`
- `contextual_plasticity_gate_applied`

## 5. Regras TODO/FIXME
- Formato: `TODO(<ID>):` e `FIXME(<ID>):`
- IDs por dominio:
- `MEM-*`, `ORC-*`, `ADP-*`, `API-*`, `AUD-*`, `RCP-*`
- Registro consolidado: [`todo_registry.md`](./todo_registry.md)

## 6. Pontos criticos de auditoria externa
- Entrada de chat ate resposta final (`services/cognitive_service.py`).
- Uso de readiness antes de plasticidade estrutural.
- Bloqueio de consolidacao em alto stress + baixa estabilidade.
- Diferenciacao entre processamento e consolidacao.
- Snapshot/restore com estado regulatorio e historico de readiness.

## 7. Critérios de revisão externa
O revisor deve conseguir:
1. Reproduzir execucao local e endpoints.
2. Seguir mutacoes de RAM por logs estruturados.
3. Verificar aplicacao do gate contextual antes de consolidacao.
4. Confirmar que persistencia e suporte, nao centro cognitivo.
