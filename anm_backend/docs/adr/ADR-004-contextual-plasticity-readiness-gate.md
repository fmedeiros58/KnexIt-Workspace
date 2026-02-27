# ADR-004: Contextual Plasticity Readiness Gate

## Decisao
Introduzir uma camada obrigatoria de prontidao plastica computacional antes da plasticidade estrutural:
- `memory/regulatory_state.py`
- `anm/plasticity_readiness.py`
- `orchestrator/contextual_plasticity_gate.py`

## Motivo
Evitar converter toda ativacao em reforco estrutural e garantir adaptacao sob seguranca funcional.

## Impacto
- Learning/pruning/consolidacao passam a ser modulados por `readiness_score`.
- Em alto `stress_load` + baixa `context_stability`, o sistema pode processar sem consolidar.
- Ressonancia e permanencia de hipoteses ficam condicionadas ao gate.

## Alternativas rejeitadas
- Plasticidade estrutural direta sem camada regulatoria precedente.
- Gate binario apenas por threshold fixo sem historico e sem fatores dominantes.
