# ANM + RAG + QIS System

Arquitetura descendente e modular para conduzir estado conversacional por camadas.

## Objetivo

Implementar pipeline mielinizado com handoffs explícitos entre entrada, contexto, memória, recuperação de conhecimento, estado quântico, reflexão, inferência, geração, estrutura textual, validação e entrega.

## Fluxo mínimo

Entrada -> normalização -> contexto -> complexidade -> memória -> busca -> QIS -> reflexão -> inferência -> geração -> estrutura textual -> validação -> entrega.

## Execução

Este módulo está em modo incremental e aditivo. O pipeline existente do chat principal permanece ativo enquanto os bridges e contratos desta arquitetura evoluem para integração progressiva.
