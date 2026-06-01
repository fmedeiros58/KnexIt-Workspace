# Diagnóstico: Renderização de Texto HTML sobre Canvas

**Data**: 01/06/2026  
**Status**: ⚠️ Pipeline Modular DESATIVADO

---

## Problema Identificado

O texto HTML não está aparecendo porque o **pipeline modular está desativado por padrão**.

### Arquitetura Atual

```
PdfPageView.tsx
├── if modularPagePipelineEnabled === true
│   ├── PdfModularPageStage (RENDERIZADOR MODULAR)
│   │   ├── PdfCanvasLayer (canvas do PDF)
│   │   └── PdfHtmlTextLayer ✅ (HTML sobre canvas)
│   │       └── PdfHtmlTextLayer.tsx (renders texto em HTML com CSS)
│   │           ├── PdfVisualTextModel (blocos extraídos)
│   │           ├── PdfTextCssFactory (estilos CSS)
│   │           └── <span> para cada run de texto
│
└── else (DEFAULT)
    ├── PdfTiledPageCanvas (renderizador legado)
    │   └── Texto rasterizado no canvas (sem HTML)
```

---

## Verificação de Componentes ✅

| Componente | Arquivo | Status |
|------------|---------|--------|
| `PdfHtmlTextLayer.tsx` | `src/modules/Knexread/rendering/text/` | ✅ Existe e funcional |
| `PdfVisualTextModelBuilder.ts` | `src/modules/Knexread/rendering/text/` | ✅ Existe e exportado |
| `PdfTextCssFactory.ts` | `src/modules/Knexread/rendering/text/` | ✅ Existe e exportado |
| `PdfModularPageStage.tsx` | `src/modules/Knexread/rendering/composition/` | ✅ Existe e renderiza PdfHtmlTextLayer |
| `PdfCanvasLayer.tsx` | `src/modules/Knexread/rendering/canvas/` | ✅ Existe |
| **PdfPageView.tsx** | `src/modules/Knexread/native-pdf-reader/components/` | ✅ Condiciona sobre `modularPagePipelineEnabled` |

### Extração de Texto ✅

1. **PdfNativeTextExtractor.ts** - Extrai texto nativo do PDF
2. **PdfOcrPipeline.ts** - Executa OCR se necessário
3. **PdfVisualTextModelBuilder** - Constrói modelo visual a partir dos blocos
4. **PdfHtmlTextLayer** - Renderiza HTML com estilos CSS

---

## Como Ativar o Pipeline Modular

### Opção 1: Via DevTools (RÁPIDO)

Abra **DevTools Console** e execute:

```javascript
// Ativa o pipeline modular
window.KNEX_PDF_USE_MODULAR_PAGE_PIPELINE = true;

// Força modo modular em todas as páginas
window.KNEX_PDF_FORCE_SINGLE_CANVAS_PAGE = true;

// (Opcional) Força camada visual de texto
window.KNEX_PDF_FORCE_VISUAL_TEXT_LAYER = true;

// Recarregue a página para aplicar
location.reload();
```

### Opção 2: Via Query String (PARA TESTES)

Adicione à URL:

```
?knex_pdf_use_modular=true
```

Depois Parse em `PdfPageView.tsx`:

```typescript
const modularPagePipelineEnabled = useMemo(() => {
  return (
    getGlobalBoolean("KNEX_PDF_USE_MODULAR_PAGE_PIPELINE") ||
    getGlobalBoolean("KNEX_PDF_FORCE_SINGLE_CANVAS_PAGE") ||
    new URLSearchParams(location.search).get("knex_pdf_use_modular") === "true"
  );
}, []);
```

### Opção 3: Por Padrão no Código (PERMANENTE)

Edite `PdfPageView.tsx`:

```typescript
function readModularPagePipelineEnabled(): boolean {
  return true; // ← Ativa por padrão
  // return (
  //   getGlobalBoolean("KNEX_PDF_USE_MODULAR_PAGE_PIPELINE") ||
  //   getGlobalBoolean("KNEX_PDF_FORCE_SINGLE_CANVAS_PAGE")
  // );
}
```

---

## Fluxo de Renderização (Quando Ativado)

```
1. PdfPageView monta e detecta modularPagePipelineEnabled = true

2. PdfModularPageStage inicia:
   ├── Detecta necessidade de OCR
   ├── Extrai texto nativo do PDF
   ├── Se falhar, executa OCR
   └── Constrói PdfVisualTextModel

3. PdfCanvasLayer renderiza:
   ├── Canvas do PDF sem texto (renderText=false)
   └── Emite evento onCanvasRenderStateChange

4. PdfHtmlTextLayer renderiza (quando textBlocks > 0):
   ├── buildPdfVisualTextModel() cria modelo
   ├── Itera sobre model.runs
   ├── Cria <span> para cada run
   ├── Aplica estilos via createPdfTextRunStyle()
   └── Texto aparece com posicionamento CSS absoluto
```

---

## Componentes de Renderização de Texto HTML

### 1. **PdfHtmlTextLayer.tsx** ✅
- Renderiza HTML sobre canvas
- Cada run é um `<span>` com posicionamento absoluto
- Suporta highlights e interação de texto
- **Estilo**: `position: absolute, inset: 0, z-[5]`

### 2. **PdfVisualTextModelBuilder.ts** ✅
- Constrói modelo visual a partir de blocos PDF
- Configura `source` (nativo ou OCR)
- Normaliza IDs dos runs
- **Entrada**: `KnexPdfTextBlock[]`
- **Saída**: `PdfVisualTextModel { pageNumber, runs, source }`

### 3. **PdfTextCssFactory.ts** ✅
- Cria estilos CSS para cada run de texto
- Converte coordenadas PDF → CSS
- Aplica zoom, rotação, escala
- **Função**: `createPdfTextRunStyle(run)`
- **Saída**: Objeto style com:
  - `position: absolute`
  - `left: X px`
  - `top: Y px`
  - `fontSize: Zpx`
  - `fontFamily`
  - `fontWeight`
  - `color`
  - etc.

### 4. **PdfModularPageStage.tsx** ✅
- Orquestra extração + renderização
- Gerencia `textPipelineStatus` (idle → extracting → ready)
- Renderiza ambas as camadas:
  - `PdfCanvasLayer` (z-0)
  - `PdfHtmlTextLayer` (z-[5])

---

## Debug: Verificar se está Funcionando

### 1. Abra DevTools e execute:

```javascript
// Verifique se a flag está ativada
console.log("modularPagePipelineEnabled:", window.KNEX_PDF_USE_MODULAR_PAGE_PIPELINE);

// Procure por elementos HTML de texto
const htmlTextLayers = document.querySelectorAll('[data-knexread-html-text-layer="true"]');
console.log("HTML Text Layers encontradas:", htmlTextLayers.length);

// Verifique o status da pipeline
const modularStages = document.querySelectorAll('[data-knexread-modular-page-stage="true"]');
console.log("Modular Stages:", modularStages.length);

modularStages.forEach((stage) => {
  console.log("Status:", stage.dataset.knexreadModularTextStatus);
  console.log("Blocos nativos:", stage.dataset.knexreadModularNativeTextBlockCount);
  console.log("HTML ativo:", stage.dataset.knexreadModularHtmlTextActive);
});

// Verifique os runs de texto
const textRuns = document.querySelectorAll('[data-knexread-html-text-run="true"]');
console.log("Text runs renderizados:", textRuns.length);
textRuns.forEach((run) => {
  console.log("Run:", run.textContent, "Confiança:", run.dataset.pdfConfidence);
});
```

### 2. Verifique no Inspector:

```html
<!-- Procure por esta estrutura -->
<div data-knexread-modular-page-stage="true" data-knexread-modular-html-text-active="true">
  <div data-knexread-modular-canvas-host="true">
    <!-- Canvas aqui -->
  </div>
  <div data-knexread-modular-html-text-host="true">
    <div data-knexread-html-text-layer="true">
      <span data-knexread-html-text-run="true">Texto aqui</span>
      <!-- ... mais spans -->
    </div>
  </div>
</div>
```

---

## Possíveis Problemas

### ❌ "Texto não aparece mesmo com pipeline ativado"

**Causa**: `textBlocks` está vazio ou `textPipelineStatus` não chegou a "ready"

**Solução**:
```javascript
// No DevTools:
document.querySelectorAll('[data-knexread-modular-page-stage="true"]').forEach(stage => {
  console.log({
    status: stage.dataset.knexreadModularTextStatus,
    blockCount: stage.dataset.knexreadModularNativeTextBlockCount,
    htmlActive: stage.dataset.knexreadModularHtmlTextActive,
    reason: stage.dataset.knexreadModularTextReason,
    ocrStatus: stage.dataset.knexreadModularOcrStatus
  });
});
```

### ❌ "Canvas está embaixo do texto HTML"

**Causa**: Z-index incorreto

**Solução**: Verifique em `PdfModularPageStage.tsx`:
- Canvas: `z-0`
- HTML Text: `z-[5]`

### ❌ "Texto desalinhado com canvas"

**Causa**: Erro em `PdfTextCssFactory.createPdfTextRunStyle()`

**Solução**: Verifique:
1. `run.x`, `run.y` (coordenadas em PT)
2. Escala de zoom aplicada
3. DPR (device pixel ratio)

---

## Resumo de Ativação

| Método | Nível | Comandos |
|--------|-------|----------|
| DevTools | Teste rápido | `window.KNEX_PDF_USE_MODULAR_PAGE_PIPELINE = true; location.reload()` |
| Query String | Teste com URL | `?knex_pdf_use_modular=true` |
| Código | Produção | Edite `readModularPagePipelineEnabled()` |

**Recomendação**: Comece com DevTools (Opção 1) para testar.

---

## Próximos Passos

1. ✅ **Ative o pipeline modular** (uma das 3 opções acima)
2. ✅ **Abra o DevTools** e verifique se o texto HTML aparece
3. ✅ **Se aparecer**: Componentes funcionam! Proceda com refinamento visual
4. ✅ **Se não aparecer**: Verifique logs de erro em `textPipelineStatus` e `textPipelineReason`

---

**Gerado em**: 01/06/2026 - KnexRead Refactor Phase 2
