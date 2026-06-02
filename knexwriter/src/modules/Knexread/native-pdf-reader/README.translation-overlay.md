# Knexread - PDF Translation Workspace

## Principio

- O PDF original permanece intacto.
- A pagina original e sempre renderizada por `PdfPageView`.
- A folha de traducao e sempre renderizada por `PdfTranslationPage`.
- A traducao nao e desenhada sobre o canvas original.
- A text layer do original existe apenas para selecao, copia, busca e ancoragem.

## Separacao visual

```text
PdfTranslationWorkspace
  OriginalDocumentPane
    SourcePage
      SourceCanvasLayer
      SourceTextLayer invisivel e selecionavel
      SourceAnnotationLayer
  TranslatedDocumentPane
    TranslationPage
      BlankPaperLayer
      TranslatedTextLayer vazia
      TranslationAnnotationLayer vazia
```

## Fluxo tecnico atual

1. `PdfPageView` renderiza o PDF original em canvas HiDPI.
2. `PdfPageView` extrai blocos de texto com coordenadas para selecao, busca e traducao futura.
3. `persistGeoTextBlocks` salva blocos geolocalizados (`pdf_geo_text_blocks`).
4. `ensureTranslationLayerForPage` cria/atualiza registros de traducao por bloco (`pdf_translation_blocks`).
5. `PdfTranslationPage` mostra uma folha branca independente, com as mesmas dimensoes visuais da pagina original.
6. A renderizacao futura da traducao deve acontecer somente dentro de `PdfTranslationPage`.

## Persistencia

- Sessao e preferencias: `pdf_reader_sessions`, `pdf_reader_preferences`
- Texto geolocalizado: `pdf_geo_text_blocks`
- Traducao por bloco: `pdf_translation_blocks`
- Historico de revisao: `pdf_translation_revisions`
- Destaques, anotacoes e citacoes continuam nos stores existentes.

## Modos de visualizacao suportados

- `normal`: mostra o PDF original.
- `side-by-side`: mostra original a esquerda e folha de traducao em branco a direita.
- `toggle`: alterna entre original e folha de traducao em branco.
- `focus-review`: preserva o original e mostra ferramentas de revisao fora da pagina.

## Pendencias fora da separacao visual

- OCR ainda usa provider mock.
- Providers de traducao ainda usam entradas mockadas.
- Exports traduzido, bilingue e com anotacoes ainda precisam de implementacao real.
