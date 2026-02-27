# ADR-002: Propagacao ressonante in-process na v1

## Decisao
Implementar propagacao ressonante e agendamento em processo unico (event-loop local), sem microservicos distribuidos.

## Motivo
Entrega incremental mais auditavel, menor complexidade operacional e alinhamento com local-first.

## Impacto
- Simplicidade de deploy e debug.
- Menor overhead de comunicacao.
- Limites de escala vertical na v1.

## Alternativas rejeitadas
- Barramento distribuido na primeira fase.
- Orquestracao multiprocesso como baseline.

