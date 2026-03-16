# Auditabilidade do 02-language-layer

## Principios

1. Determinismo local: detectores de superficie devem produzir saida reprodutivel para a mesma entrada.
2. Responsabilidade unica: cada arquivo faz uma etapa linguistica clara e auditavel.
3. Contratos explicitos: validacao de estado e handoff com campos obrigatorios.
4. Trilha de decisao: `languageState.auditTrail` registra decisoes por estagio.
5. Handoff podado: conversation-layer recebe somente sinais necessarios.

## Controles implementados

- Contratos: `contracts/language-state-contract.ts` e `contracts/language-handoff-contract.ts`.
- Validacao de estado: `language-state-validator.ts`.
- Normalizacao padronizada: `language-state-normalizer.ts`.
- Rastro operacional: `language-trace-recorder.ts` + `state.trace`.
- Evidencia de diagnostico: `executionArtifacts.languageLayer` com passos de normalizacao e validacao.

## Checklist de auditoria

- O arquivo possui descricao de responsabilidade no topo.
- O detector nao invade responsabilidade de outro nucleo.
- O resultado possui score/flags em ranges consistentes.
- O estado final passa pelo normalizador e validador.
- O handoff inclui apenas os campos definidos no contrato.
