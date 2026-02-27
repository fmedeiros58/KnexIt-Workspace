# TODO Registry V2

| ID | Arquivo | Tipo | Descricao | Impacto | Prioridade | Status |
|---|---|---|---|---|---|---|
| ADP-001 | `adapters/engine_client.py` | TODO | **Concluido nesta etapa:** binding real OpenAI-like local com `invoke()` e `health()` auditaveis. | Motor real agora acoplado ao ciclo `/chat`. | Alta | Concluido |
| ADP-002 | `adapters/engine_client.py` | TODO | Suportar roteamento multi-provider no `invoke(payload)` alem de endpoint OpenAI-compat. | Permite bind de motores com contrato diferente. | Media | Aberto |
| ORC-001 | `orchestrator/resonance_engine.py` | TODO | Evoluir criterio de convergencia para media + variancia + energia residual. | Reduz ciclos improdutivos em cenarios complexos. | Media | Aberto |
| MEM-001 | `memory/memory_manager.py` | TODO | Adicionar transacao leve para batch de mutacoes multi-memoria. | Reduz risco de estado parcial sob erro no meio do ciclo. | Media | Aberto |
| RCP-001 | `anm/plasticity_readiness.py` | TODO | Calibrar pesos do readiness com telemetria real de execucao. | Melhora estabilidade da modulação plastica. | Alta | Aberto |
| API-001 | `api/routes_debug.py` | TODO | Restringir debug por feature-flag/ambiente seguro. | Evita exposicao de topologia/memoria em producao. | Alta | Aberto |
| AUD-001 | `audit.py` | TODO | Incluir nivel de severidade e hash de integridade no envelope de log. | Aumenta rastreabilidade forense. | Baixa | Aberto |
