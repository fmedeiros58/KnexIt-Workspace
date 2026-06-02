# KnexRead - Mapa Completo da Arquitetura de Renderização

**Data**: 01/06/2026  
**Problema**: Texto renderizado como rasterizado (PDF.js) ao invés de HTML vetorial com qualidade  
**Status**: Diagnóstico da arquitetura

---

## 📍 Problema Identificado

O texto está aparecendo **rasterizado** (como imagem do PDF.js) porque há várias camadas de renderização, e o **HTML text layer pode não estar sendo montado corretamente ou estar atrás do canvas**.

---

## 🏗️ Arquitetura em 3 Níveis

### Nível 1: Router de Pipeline (PdfPageView.tsx)
**Arquivo**: `src/modules/Knexread/native-pdf-reader/components/PdfPageView.tsx`  
**Linhas**: ~1300-1400 (no return/JSX)

```typescript
// Router que decide qual pipeline usar
if (modularPagePipelineEnabled) {
  // ← NOVO: Modular (HTML text + canvas separado)
  <PdfModularPageStage ... />
} else {
  // ← LEGADO: Tiled canvas (texto rasterizado)
  <PdfTiledPageCanvas ... />
}
```

**Status do roteador**: Verifica `session.isLegacy`

---

### Nível 2: Composição de Camadas (PdfModularPageStage.tsx)
**Arquivo**: `src/modules/Knexread/rendering/composition/PdfModularPageStage.tsx`  
**Responsabilidade**: Orquestra extração de texto + renderização

#### Fluxo Interno:
```
PdfModularPageStage.tsx
├─ Detecta necessidade de OCR (PdfOcrNeedDetector)
├─ Extrai texto nativo (PdfNativeTextExtractor)
├─ Executa OCR se necessário (PdfOcrPipeline)
├─ Constrói visual model (buildPdfVisualTextModel)
└─ Renderiza duas camadas:
   ├─ [z-0]  PdfCanvasLayer (canvas do PDF, sem texto)
   └─ [z-5]  PdfHtmlTextLayer (spans HTML com CSS)
```

**Saída do estado**:
```typescript
const visualTextModel = useMemo(
  () =>
    textBlocks.length > 0
      ? buildPdfVisualTextModel({ ... })
      : { ...EMPTY_TEXT_MODEL, pageNumber },
  [ocrStatus, pageNumber, textBlocks],
);

return (
  <div data-knexread-modular-page-stage="true">
    {/* Canvas embaixo */}
    <PdfCanvasLayer ... renderText={!hasHtmlText} />
    
    {/* HTML text por cima */}
    {hasHtmlText ? (
      <PdfHtmlTextLayer model={visualTextModel} />
    ) : null}
  </div>
);
```

---

### Nível 3A: Canvas (PdfCanvasLayer.tsx)
**Arquivo**: `src/modules/Knexread/rendering/canvas/PdfCanvasLayer.tsx`  
**Z-Index**: `z-0`  
**Responsabilidade**: Renderizar PDF sem texto (opcional)

#### Props Importantes:
```typescript
interface PdfCanvasLayerProps {
  renderText: boolean;  // ← CRÍTICO: Se false, filtra texto do PDF.js
  renderQuality: PdfRenderQualityMode;
  pageCssWidth: number;
  pageCssHeight: number;
}
```

#### Lógica de Filtragem de Texto:
```typescript
// Dentro do PdfCanvasLayer
if (!renderText) {
  // Remove operações de texto do PDF.js usando operationList filter
  operationList.fnArray = operationList.fnArray.filter(
    (fn, i) => {
      const opName = pdf.OPS[fn];
      return !TEXT_OPS.includes(opName);
      // TEXT_OPS = ['showText', 'showSpacedText', 'nextLineShowText', ...]
    }
  );
}
```

**Resultado**: Canvas sem texto renderizado ✓

---

### Nível 3B: HTML Text Layer (PdfHtmlTextLayer.tsx)
**Arquivo**: `src/modules/Knexread/rendering/text/PdfHtmlTextLayer.tsx`  
**Z-Index**: `z-[5]` (Tailwind: 50)  
**Responsabilidade**: Renderizar spans HTML sobre canvas

#### Estrutura de Saída:
```jsx
<div
  className="knex-pdf-html-text-layer"
  data-knexread-html-text-layer="true"
  style={{
    position: "absolute",
    inset: 0,           // ← Cobre todo o container
    pointerEvents: "auto",
    userSelect: "text", // ← Permite seleção
    zIndex: "50",       // ← ACIMA do canvas (z-0)
  }}
>
  {model.runs.map((run) => (
    <span
      key={run.id}
      data-knexread-html-text-run="true"
      style={{
        ...createPdfTextRunStyle(run),  // ← CSS posicionado
        backgroundColor: highlighted ? "rgba(...)" : "transparent",
      }}
    >
      {run.text}
    </span>
  ))}
</div>
```

**Cada `<span>` recebe estilos de**:  
📄 [PdfTextCssFactory.ts](src/modules/Knexread/rendering/text/PdfTextCssFactory.ts)

---

## 🎨 Z-Index Stack (Ordem Visual)

| Nível | Z-Index | Componente | Arquivo | Propósito |
|-------|---------|-----------|---------|----------|
| 6 | z-50 | Debug Overlay | `PdfDebugOverlay` | Diagnóstico |
| **5** | **z-[5]** | **HTML Text** | `PdfHtmlTextLayer` | ⭐ **TEXTO VETORIAL AQUI** |
| 4 | z-10 | Anotações (acima) | `PdfAnnotationLayer` | Drawings |
| 3 | z-0 | **Canvas** | `PdfCanvasLayer` | Imagem do PDF |
| 2 | (none) | Anotações (atrás) | `PdfAnnotationLayer` | Shapes behind |
| 1 | - | Container | `PdfPageView` | Base |

---

## 🔍 Fluxo Completo de Renderização (Diagrama)

```
┌─────────────────────────────────────────────────────────────┐
│ PdfPageView.tsx (Router Principal)                          │
│ Verifica: session.isLegacy                                  │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
   isLegacy=true                         isLegacy=false
   (PDF.js 2.x)                          (PDF.js 3.x+)
        │                                     │
        ▼                                     ▼
┌──────────────────────┐        ┌────────────────────────────┐
│ PdfTiledPageCanvas   │        │ PdfModularPageStage.tsx    │
│ (LEGADO)             │        │ (NOVO - MODULAR)           │
│                      │        │                            │
│ • 16x2 grid tiles    │        │ Step 1: Detect OCR need    │
│ • Texto rasterizado  │        │   ↓                        │
│ • Compatibilidade    │        │ Step 2: Extract native text│
│ • Qualidade média    │        │   ↓                        │
│                      │        │ Step 3: Run OCR if needed  │
│ Z-Stack:             │        │   ↓                        │
│ • z-0: tiles         │        │ Step 4: Build visual model │
│ • z-20: invisible    │        │   ↓                        │
│   text layer         │        │ Step 5: Mount layers:      │
└──────────────────────┘        │                            │
                                │ ┌─────────────────────┐    │
                                │ │ Z-Stack (Modular):  │    │
                                │ │                     │    │
                                │ │ z-[5]: HTML Text    │    │
                                │ │ ↑                   │    │
                                │ │ z-0: Canvas         │    │
                                │ │                     │    │
                                │ │ PdfHtmlTextLayer:   │    │
                                │ │ <div> + <span>×N    │    │
                                │ │                     │    │
                                │ │ PdfCanvasLayer:     │    │
                                │ │ <canvas>            │    │
                                │ │ (sem texto)         │    │
                                │ └─────────────────────┘    │
                                └────────────────────────────┘
```

---

## ⚠️ Por Que Ainda Mostra Texto Rasterizado?

### Cenário 1: HTML Layer Não Está Sendo Montado
**Diagnóstico**: Verificar se `textBlocks.length === 0`

```javascript
// No DevTools:
const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
console.log("Status:", stage?.dataset.knexreadModularTextStatus);
console.log("Block count:", stage?.dataset.knexreadModularNativeTextBlockCount);
console.log("HTML active:", stage?.dataset.knexreadModularHtmlTextActive);

// Se "html-active" = false → nenhum bloco extraído
// Se "html-active" = true → HTML deveria estar visível
```

**Causas Possíveis**:
- ❌ PDF sem texto nativo (scanned/imagem) → OCR não executou
- ❌ Extração falhou silenciosamente
- ❌ OCR retornou blocos vazios

**Solução**: Ativar debug logging

---

### Cenário 2: HTML Layer Está Embaixo do Canvas
**Diagnóstico**: Z-index errado

```javascript
// No DevTools Inspector:
// 1. Procure por: <div data-knexread-html-text-layer="true">
// 2. Verifique computed z-index
// 3. Compare com z-index do canvas

// Se z-index HTML < z-index Canvas → PROBLEMA! 
// HTML escondida pelo canvas
```

**Solução**: Verificar CSS em `PdfModularPageStage.tsx`:
```typescript
// Deve ser:
// <div className="absolute inset-0 z-[5]">  ← z-[5]
//   <PdfHtmlTextLayer ... />
// </div>
```

---

### Cenário 3: PDF é Legado (PDF.js 2.x)
**Diagnóstico**:
```javascript
// No DevTools:
const page = document.querySelector('[data-knexread-page-render-mode]');
console.log(page?.dataset.knexreadPageRenderMode);

// Se "tiled-canvas" → usando legado (esperado para PDF.js 2.x)
// Se "single-canvas-html-text" → usando modular
```

**Solução**: Nada a fazer se PDF é legado (compatibilidade)

---

### Cenário 4: Canvas Renderizando com Texto
**Diagnóstico**:
```javascript
// Procure por:
const canvas = document.querySelector('canvas');
console.log(canvas?.getAttribute('data-knexPdfCanvasTextMode'));

// Se "normal" → texto está no canvas (ERRADO)
// Se "without-text" → texto filtrado corretamente
```

**Solução**: Verificar se `renderText={!hasHtmlText}` está sendo passado corretamente para `PdfCanvasLayer`

---

## 📊 Checklist de Renderização de Qualidade

```
Para que HTML text apareça com QUALIDADE:

☐ 1. PDF é não-legado?
      session.isLegacy === false ✓

☐ 2. Modular pipeline ativado?
      data-knexread-page-render-mode === "single-canvas-html-text" ✓

☐ 3. Texto foi extraído?
      data-knexread-modular-native-text-block-count > 0 ✓

☐ 4. HTML layer foi montado?
      <div data-knexread-html-text-layer="true"> existe ✓

☐ 5. HTML layer tem spans?
      <span data-knexread-html-text-run="true"> × N > 0 ✓

☐ 6. HTML layer tem z-index correto?
      z-[5] (50) > z-0 (canvas) ✓

☐ 7. Canvas não renderizando texto?
      data-knexPdfCanvasTextMode === "without-text" ✓

☐ 8. Estilos CSS aplicados aos spans?
      style="position:absolute; left:Xpx; top:Ypx; font-size:Zpx" ✓

Se TODOS ✓ → Texto deve aparecer com QUALIDADE VETORIAL
Se algum ✗ → Investigar causa raiz
```

---

## 🔧 Debug Completo no DevTools

### Script de Diagnóstico Completo:

```javascript
// ═══════════════════════════════════════════════════════════════
// KnexRead Rendering Quality Diagnostic
// ═══════════════════════════════════════════════════════════════

const diag = {
  // 1. Pipeline Type
  getPipelineType: () => {
    const page = document.querySelector('[data-knexread-page-render-mode]');
    return page?.dataset.knexreadPageRenderMode;
  },

  // 2. Session Legacy Status
  getSessionLegacy: () => {
    const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
    return stage ? "Modular (non-legacy)" : "Tiled (legacy?)";
  },

  // 3. Text Extraction Status
  getTextExtractionStatus: () => {
    const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
    return {
      status: stage?.dataset.knexreadModularTextStatus,
      blockCount: parseInt(stage?.dataset.knexreadModularNativeTextBlockCount || 0),
      htmlActive: stage?.dataset.knexreadModularHtmlTextActive === "true",
      reason: stage?.dataset.knexreadModularTextReason,
    };
  },

  // 4. HTML Layer Presence
  getHtmlLayerStatus: () => {
    const layers = document.querySelectorAll('[data-knexread-html-text-layer="true"]');
    const runs = document.querySelectorAll('[data-knexread-html-text-run="true"]');
    return {
      layersFound: layers.length,
      runsFound: runs.length,
      firstRun: runs[0]?.textContent.slice(0, 50),
    };
  },

  // 5. Canvas Text Mode
  getCanvasTextMode: () => {
    const canvas = document.querySelector('canvas');
    return canvas?.getAttribute('data-knexPdfCanvasTextMode') || "unknown";
  },

  // 6. Z-Index Stack
  getZIndexStack: () => {
    const canvas = document.querySelector('canvas');
    const htmlLayer = document.querySelector('[data-knexread-html-text-layer="true"]');
    return {
      canvas: window.getComputedStyle(canvas?.parentElement || canvas || {}).zIndex,
      htmlLayer: window.getComputedStyle(htmlLayer || {}).zIndex,
    };
  },

  // 7. Text Run Styling Sample
  getSampleRunStyling: () => {
    const run = document.querySelector('[data-knexread-html-text-run="true"]');
    return {
      position: run?.style.position,
      left: run?.style.left,
      top: run?.style.top,
      fontSize: run?.style.fontSize,
      fontFamily: run?.style.fontFamily,
    };
  },

  // RUN ALL
  runFullDiagnostic: function() {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("KnexRead Rendering Diagnostic");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("\n1️⃣ Pipeline Type:", this.getPipelineType());
    console.log("2️⃣ Session Legacy:", this.getSessionLegacy());
    console.log("3️⃣ Text Extraction:", this.getTextExtractionStatus());
    console.log("4️⃣ HTML Layer:", this.getHtmlLayerStatus());
    console.log("5️⃣ Canvas Text Mode:", this.getCanvasTextMode());
    console.log("6️⃣ Z-Index Stack:", this.getZIndexStack());
    console.log("7️⃣ Sample Run Styling:", this.getSampleRunStyling());
    console.log("\n═══════════════════════════════════════════════════════════════");
  }
};

// Execute:
diag.runFullDiagnostic();
```

---

## 📂 Localização de Todos os Arquivos Críticos

### Canvas Layer
- **Arquivo**: `src/modules/Knexread/rendering/canvas/PdfCanvasLayer.tsx`
- **Responsabilidade**: Renderizar PDF sem texto (quando modular ativo)
- **Linhas críticas**: Operação filter que remove texto do PDF.js

### HTML Text Layer
- **Arquivo**: `src/modules/Knexread/rendering/text/PdfHtmlTextLayer.tsx`
- **Responsabilidade**: Renderizar spans HTML posicionados
- **Linhas críticas**: Map over `model.runs` e criar spans com CSS

### Text CSS Styling
- **Arquivo**: `src/modules/Knexread/rendering/text/PdfTextCssFactory.ts`
- **Responsabilidade**: Gerar estilos CSS para cada run
- **Crítico**: Converte coordenadas PDF → CSS

### Visual Model Builder
- **Arquivo**: `src/modules/Knexread/rendering/text/PdfVisualTextModelBuilder.ts`
- **Responsabilidade**: Transforma blocos extraídos em modelo visual
- **Entrada**: `KnexPdfTextBlock[]` (do OCR/native)
- **Saída**: `PdfVisualTextModel` (para HTML layer)

### Orchestrator
- **Arquivo**: `src/modules/Knexread/rendering/composition/PdfModularPageStage.tsx`
- **Responsabilidade**: Coordena extração → renderização
- **Crítico**: Decide quando HTML layer é montada

### Router Principal
- **Arquivo**: `src/modules/Knexread/native-pdf-reader/components/PdfPageView.tsx`
- **Responsabilidade**: Rota entre modular e legado
- **Linhas críticas**: ~1300-1500 (return/JSX)

### Legacy Fallback
- **Arquivo**: `src/modules/Knexread/native-pdf-reader/components/pdf-tiles/PdfTiledPageCanvas.tsx`
- **Responsabilidade**: Renderiza 16x2 grid se PDF for legado
- **Z-Stack**: z-0 tiles + z-20 invisible text

---

## 🎯 Próximos Passos para Diagnóstico

1. **Abra DevTools** e execute o script de diagnóstico acima
2. **Compartilhe o output** dos 7 pontos
3. Identifique qual ponto falha
4. Vamos corrigir naquele nível específico

---

**Gerado**: 01/06/2026 - KnexRead Architecture Analysis
