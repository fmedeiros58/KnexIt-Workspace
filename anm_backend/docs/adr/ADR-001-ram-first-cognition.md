# ADR-001: RAM-first cognition

## Decisao
A cognicao ativa da ANM vive prioritariamente em RAM (`RamCortex`, `WorkingMemory`, pools de hipoteses e estado de nódulos).

## Motivo
Baixa latencia e mutabilidade rapida sao requisitos para propagacao ressonante e superposicao probabilistica.

## Impacto
- Menor latencia no raciocinio online.
- Necessidade de politicas de esquecimento e checkpoint frequente.
- Persistencia local passa a ser suporte operacional, nao nucleo cognitivo.

## Alternativas rejeitadas
- Persistencia como fonte primaria de estado.
- Cache distribuido como base inicial.

