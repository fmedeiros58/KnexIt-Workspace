# 📍 Localização dos Arquivos de Renderização - Mapa Visual

**Quick Reference Map - KnexRead Rendering System**

```
src/modules/Knexread/
│
├─ 📦 rendering/ (Pipeline Modular - Novo)
│  │
│  ├─ 📄 composition/
│  │  └─ 🔴 PdfModularPageStage.tsx
│  │     └─ ORQUESTRA tudo: extração → renderização
│  │     └─ Monta canvas + HTML text layers
│  │     └─ ARQUIVO CRÍTICO #1
│  │
│  ├─ 🎨 canvas/
│  │  ├─ 🔴 PdfCanvasLayer.tsx
│  │  │  └─ Renderiza canvas SEM texto
│  │  │  └─ Z-INDEX: z-0 (embaixo)
│  │  │  └─ ARQUIVO CRÍTICO #2
│  │  │
│  │  ├─ BlankCanvasBuilder.ts
│  │  │  └─ Cria canvas com dimensões corretas
│  │  │
│  │  └─ PdfSingleCanvasRenderer.ts
│  │     └─ Rasteriza PDF.js para canvas
│  │
│  ├─ 📝 text/
│  │  ├─ 🔴 PdfHtmlTextLayer.tsx
│  │  │  └─ Renderiza <span> com CSS
│  │  │  └─ Z-INDEX: z-[5] (ACIMA do canvas)
│  │  │  └─ ARQUIVO CRÍTICO #3
│  │  │
│  │  ├─ 🔴 PdfTextCssFactory.ts
│  │  │  └─ Gera estilos CSS para cada run
│  │  │  └─ Position absolute, left, top, fontSize
│  │  │  └─ ARQUIVO CRÍTICO #4
│  │  │
│  │  ├─ 🔴 PdfVisualTextModelBuilder.ts
│  │  │  └─ Transforma blocos → modelo visual
│  │  │  └─ Entrada: KnexPdfTextBlock[]
│  │  │  └─ Saída: PdfVisualTextModel
│  │  │  └─ ARQUIVO CRÍTICO #5
│  │  │
│  │  └─ PdfTextSelectionController.ts
│  │     └─ Gerencia seleção de texto
│  │
│  └─ 📦 annotations/ & 🔍 extraction/
│     └─ (Suportes)
│
├─ 🏛️ native-pdf-reader/
│  │
│  ├─ 📦 components/
│  │  ├─ 🔴 PdfPageView.tsx
│  │  │  └─ ROUTER PRINCIPAL
│  │  │  └─ Decide: modular vs legado
│  │  │  └─ Linhas ~1300-1500 (return/JSX)
│  │  │  └─ ARQUIVO CRÍTICO #6
│  │  │
│  │  ├─ pdf-tiles/
│  │  │  └─ 🟡 PdfTiledPageCanvas.tsx
│  │  │     └─ FALLBACK LEGADO
│  │  │     └─ Renderiza tiles 16x2
│  │  │     └─ Texto rasterizado (compatibilidade)
│  │  │     └─ Usado quando isLegacy=true
│  │  │
│  │  └─ (Outros: PdfTextLayer, PdfHighlightLayer, etc)
│  │
│  └─ 📦 services/
│     └─ 🔴 pdfLoader.service.ts
│        └─ Define NativePdfSession type
│        └─ Detecta session.isLegacy
│        └─ ARQUIVO CRÍTICO #7
│
└─ 🛠️ extraction/
   │
   ├─ ocr/
   │  └─ PdfOcrPipeline.ts
   │     └─ OCR fallback para PDFs scaneados
   │
   ├─ native-text/
   │  └─ PdfNativeTextExtractor.ts
   │     └─ Extrai texto nativo do PDF.js
   │
   └─ (Mais modulos...)
```

---

## 🔴 7 Arquivos CRÍTICOS para Qualidade de Texto

| # | Arquivo | Z-Index | Função | Status |
|---|---------|---------|--------|--------|
| 1 | **PdfPageView.tsx** | - | Router (modular vs legado) | 🟢 Router ativo |
| 2 | **PdfModularPageStage.tsx** | - | Orquestra pipeline | 🟢 Orquestra |
| 3 | **PdfCanvasLayer.tsx** | z-0 | Canvas (sem texto) | 🔄 Verificar |
| 4 | **PdfHtmlTextLayer.tsx** | z-[5] | HTML text (spans) | 🔴 **AQUI O TEXTO DEVE VIR** |
| 5 | **PdfTextCssFactory.ts** | - | Estilos CSS | 🔄 Verificar |
| 6 | **PdfVisualTextModelBuilder.ts** | - | Modelo visual | 🔄 Verificar |
| 7 | **pdfLoader.service.ts** | - | Detecta legacy | 🟢 Detecta |

---

## 🎯 Por Que Texto Rasterizado Aparece?

### Caminho 1: HTML Layer Não Existe (0 blocks)
```
PdfNativeTextExtractor falha
    ↓
OCR não executado ou falha
    ↓
textBlocks.length === 0
    ↓
hasHtmlText = false
    ↓
PdfHtmlTextLayer NÃO MONTADA
    ↓
❌ CANVAS COM TEXTO RASTERIZADO APARECE
```

**Verificar**:
```javascript
const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
console.log(stage?.dataset.knexreadModularNativeTextBlockCount);  // Deve ser > 0
```

---

### Caminho 2: HTML Layer Está Embaixo do Canvas
```
PdfHtmlTextLayer EXISTE (500+ spans)
    ↓
Mas Z-INDEX está errado
    ↓
Canvas (z-0) está ACIMA de HTML (z-?)
    ↓
❌ HTML ESCONDIDA, CANVAS VISÍVEL
```

**Verificar**:
```javascript
const htmlLayer = document.querySelector('[data-knexread-html-text-layer="true"]');
const canvasContainer = document.querySelector('[data-knexread-modular-canvas-host="true"]');
console.log("HTML Z-Index:", window.getComputedStyle(htmlLayer).zIndex);
console.log("Canvas Z-Index:", window.getComputedStyle(canvasContainer).zIndex);
// HTML.zIndex DEVE SER > Canvas.zIndex
```

---

### Caminho 3: PDF é Legado (PDF.js 2.x)
```
session.isLegacy === true
    ↓
shouldUseModularPagePipeline() retorna false
    ↓
PdfTiledPageCanvas é renderizado (FALLBACK)
    ↓
❌ TILES 16x2, TEXTO RASTERIZADO
```

**Verificar**:
```javascript
const pageView = document.querySelector('[data-knexread-pageview-audit-version]');
console.log(pageView?.dataset.knexreadPageRenderMode);
// "single-canvas-html-text" = modular (esperado)
// "tiled-canvas" = legado
```

---

### Caminho 4: Canvas Renderizando com Texto
```
renderText prop recebeu FALSE
    ↓
Mas operação filter de texto NÃO FUNCIONOU
    ↓
PDF.js ainda renderizou texto no canvas
    ↓
❌ CANVAS COM TEXTO RASTERIZADO
```

**Verificar**:
```javascript
const canvas = document.querySelector('canvas');
console.log(canvas?.getAttribute('data-knexPdfCanvasTextMode'));
// "without-text" = correto (texto filtrado)
// "normal" = ERRO (texto ainda no canvas)
```

---

## 🔍 Script de Diagnóstico Rápido

Cole no DevTools Console:

```javascript
console.log("═══ KNEXREAD RENDERING DIAGNOSIS ═══\n");

// 1. Pipeline Type
const pageView = document.querySelector('[data-knexread-pageview-audit-version]');
console.log("1️⃣ Pipeline:", pageView?.dataset.knexreadPageRenderMode || "N/A");

// 2. Modular Pipeline Status
const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
if (stage) {
  console.log("2️⃣ Text Extraction:", stage?.dataset.knexreadModularTextStatus);
  console.log("   Blocks:", stage?.dataset.knexreadModularNativeTextBlockCount);
  console.log("   HTML Active:", stage?.dataset.knexreadModularHtmlTextActive);
  console.log("   Reason:", stage?.dataset.knexreadModularTextReason);
} else {
  console.log("2️⃣ ❌ NO MODULAR STAGE FOUND (usando legacy?)");
}

// 3. HTML Layer
const htmlLayers = document.querySelectorAll('[data-knexread-html-text-layer="true"]');
console.log("3️⃣ HTML Layers found:", htmlLayers.length);

// 4. HTML Runs
const runs = document.querySelectorAll('[data-knexread-html-text-run="true"]');
console.log("4️⃣ HTML Text Runs:", runs.length);
if (runs.length > 0) {
  console.log("   First run:", runs[0].textContent.slice(0, 50));
  console.log("   Position:", runs[0].style.position);
  console.log("   Z-Index:", window.getComputedStyle(runs[0]).zIndex);
}

// 5. Canvas Text Mode
const canvas = document.querySelector('canvas');
console.log("5️⃣ Canvas text mode:", canvas?.getAttribute('data-knexPdfCanvasTextMode'));

// 6. Z-Index Stack
const htmlLayer = document.querySelector('[data-knexread-html-text-layer="true"]');
const canvasHost = document.querySelector('[data-knexread-modular-canvas-host="true"]');
console.log("\n6️⃣ Z-INDEX STACK:");
console.log("   Canvas host:", window.getComputedStyle(canvasHost).zIndex);
console.log("   HTML layer:", window.getComputedStyle(htmlLayer).zIndex);

console.log("\n═════════════════════════════════════");
```

---

## 💡 Interpretando o Output

### ✅ Diagnóstico BELO (Esperado)
```
1️⃣ Pipeline: single-canvas-html-text
2️⃣ Text Extraction: ready
   Blocks: 342
   HTML Active: true
   Reason: native-text-ready
3️⃣ HTML Layers found: 1
4️⃣ HTML Text Runs: 342
   First run: Lorem ipsum dolor sit amet
   Position: absolute
   Z-Index: 50
5️⃣ Canvas text mode: without-text
6️⃣ Z-INDEX STACK:
   Canvas host: 0
   HTML layer: 50
   
RESULTADO: ✅ TEXTO HTML VETORIAL (QUALIDADE ALTA)
```

### ❌ Diagnóstico RUIM #1 (0 Blocks)
```
1️⃣ Pipeline: single-canvas-html-text
2️⃣ Text Extraction: ready
   Blocks: 0  ← ⚠️ PROBLEMA!
   HTML Active: false
   Reason: native-text-failed
3️⃣ HTML Layers found: 0
4️⃣ HTML Text Runs: 0
5️⃣ Canvas text mode: without-text
6️⃣ Z-INDEX STACK:
   Canvas host: 0
   HTML layer: undefined

RESULTADO: ❌ CANVAS SEM TEXTO (BRANCO)
CAUSA: Extração falhou
```

### ❌ Diagnóstico RUIM #2 (Z-Index Errado)
```
1️⃣ Pipeline: single-canvas-html-text
2️⃣ Text Extraction: ready
   Blocks: 342  ✅
   HTML Active: true  ✅
3️⃣ HTML Layers found: 1  ✅
4️⃣ HTML Text Runs: 342  ✅
5️⃣ Canvas text mode: without-text  ✅
6️⃣ Z-INDEX STACK:
   Canvas host: 50  ← ⚠️ ERRADO!
   HTML layer: auto ← ⚠️ ERRADO!

RESULTADO: ❌ CANVAS APARECE ACIMA DO HTML (ESCONDIDO)
CAUSA: Z-index invertido
```

### ❌ Diagnóstico RUIM #3 (Legado)
```
1️⃣ Pipeline: tiled-canvas  ← ⚠️ LEGADO!
2️⃣ ❌ NO MODULAR STAGE FOUND (usando legacy?)
3-6️⃣ (N/A - legacy pipeline)

RESULTADO: ❌ TILES 16x2, TEXTO RASTERIZADO
CAUSA: PDF.js 2.x (legacy runtime) detectado
```

---

## 🎯 O Que Fazer Agora

1. **Execute o script de diagnóstico** (cole no DevTools Console)
2. **Compare com um dos 3 cenários acima**
3. **Compartilhe o resultado comigo**
4. Vou debugar o problema específico

---

## 📂 Resumo de Localização

| O Quê | Onde | Por Quê |
|-------|------|--------|
| **Texto renderizado como rasterizado?** | `PdfHtmlTextLayer.tsx` não montada OU z-index errado | Verificar bloco #4 do diagnóstico |
| **Onde está HTML text?** | `src/modules/Knexread/rendering/text/` | 📝 Renderização HTML |
| **Onde está canvas?** | `src/modules/Knexread/rendering/canvas/` | 🎨 Renderização raster |
| **Quem decide qual usar?** | `src/modules/Knexread/native-pdf-reader/components/PdfPageView.tsx` | 🏛️ Router |
| **Quem orquestra?** | `src/modules/Knexread/rendering/composition/PdfModularPageStage.tsx` | 🎼 Orquestrador |
| **Estilos CSS do texto?** | `src/modules/Knexread/rendering/text/PdfTextCssFactory.ts` | 🎨 Estilização |

---

**Gerado**: 01/06/2026
