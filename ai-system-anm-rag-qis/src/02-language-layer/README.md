# 02-language-layer

## Objetivo

O `02-language-layer` consolida diagnostico linguistico de superficie antes do `03-conversation-layer`.

## Responsabilidades por nucleo

- `multilingual-language-core/`: idioma dominante, locale, dialeto e code-switching.
- `linguistic-normalization-core/`: limpeza e estabilizacao do texto para processamento.
- `pragmatic-language-core/`: ato de fala, intencao pragmatica e forca diretiva.
- `semantic-language-core/`: semantica de superficie (ancoras, referencia, ambiguidade, modal, negacao, quantificadores).
- `discourse-form-core/`: forma do turno (frase, fragmento, repeticao, reparo, mudanca de topico).
- `stylistic-language-core/`: tom, afeto, urgencia, frustracao e estilo de confianca.

## Orquestracao

`language-layer-bridge.ts` executa a ordem:

1. `language-detection`
2. `normalization`
3. `pragmatic`
4. `semantic-surface`
5. `discourse-form`
6. `stylistic-affective`
7. `state-consolidation`
8. `trace`

## Handoff

`language-to-conversation-bridge.ts` nao envia o estado linguistico completo para a camada seguinte.
Ele envia payload podado com:

- texto estabilizado
- idioma consolidado
- ato de fala
- intencao pragmatica
- marcadores referenciais
- sinais de ambiguidade
- repeticao detectada
- tom emocional
- urgencia
- sinais de reparo discursivo

## Regra de nao sobreposicao

- Semantica de superficie nao faz inferencia profunda.
- Tom/afeto nao decide estrategia conversacional.
- Speech-act nao executa gerenciamento de dialogo.
- Deteccao de idioma nao substitui contexto/sessao.
