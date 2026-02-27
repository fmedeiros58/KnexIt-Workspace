# ADR-003: Integracao com engine existente via adapter OpenAI-compatible

## Decisao
A ANM usa `EngineClient` para chamar o servidor existente compativel com OpenAI (`/chat/completions`), sem alterar motor nem runtime.

## Motivo
Preservar stack de inferencia ja funcional e permitir evolucao da casca cognitiva com baixo impacto.

## Impacto
- Acoplamento minimo ao provider.
- Troca de endpoint/modelo por variaveis de ambiente.
- Necessidade de parser robusto para formatos de resposta.

## Alternativas rejeitadas
- Substituir motor local.
- Reimplementar camada de inferencia.

