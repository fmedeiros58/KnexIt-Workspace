# 🔍 Checklist de Qualidade de Texto - Step by Step

**Data**: 01/06/2026  
**Objetivo**: Identificar por que o texto ainda aparece rasterizado

---

## ⚡ Diagnóstico em 30 Segundos

Execute no DevTools Console:

```javascript
[
  document.querySelector('[data-knexread-page-render-mode]')?.dataset.knexreadPageRenderMode,
  document.querySelector('[data-knexread-modular-page-stage="true"]') ? 'MODULAR' : 'LEGACY',
  parseInt(document.querySelector('[data-knexread-modular-page-stage="true"]')?.dataset.knexreadModularNativeTextBlockCount || 0),
  document.querySelectorAll('[data-knexread-html-text-run="true"]').length
].forEach((x,i) => console.log(['Pipeline','Stage','Blocks','Runs'][i]+':', x))
```

**Esperado**: 
```
Pipeline: single-canvas-html-text
Stage: MODULAR
Blocks: >0 (ex: 342)
Runs: >0 (ex: 342)
```

---

## 🔧 5 Pontos de Verificação Crítica

### ✓ Ponto 1: Pipeline Correto?

**Arquivo**: `PdfPageView.tsx` (linha ~1300)

**O que deve estar acontecendo**:
```typescript
if (modularPagePipelineEnabled) {
  // ← Isso deve ser TRUE
  <PdfModularPageStage ... />
} else {
  // Isso não deve executar
  <PdfTiledPageCanvas ... />
}
```

**Como verificar**:
```javascript
// DevTools:
document.querySelector('[data-knexread-page-render-mode]').dataset.knexreadPageRenderMode
// Esperado: "single-canvas-html-text"
// Se "tiled-canvas": Pipeline legado (problema)
```

**Se falhar** → `session.isLegacy === true` (PDF.js 2.x detectado)

---

### ✓ Ponto 2: Extração de Texto Funcionando?

**Arquivo**: `PdfModularPageStage.tsx` (linha ~120)

**O que deve estar acontecendo**:
```typescript
// 1. Detecta necessidade de OCR
const ocrNeed = detectPdfOcrNeed({
  nativeTextBlockCount: nativeText.blocks.length,  // ← Deve ter > 0
  nativeTextConfidence: nativeText.confidence,
});

// 2. Extrai texto
const nativeText = await extractPdfNativeText({...});
// ← Deve retornar blocks[]

// 3. Se vazio, executa OCR
const ocrResult = await runPdfOcrPipeline({...});

// 4. Monta bloco final
const nextBlocks = 
  nativeText.blocks.length > 0 ? nativeText.blocks : ocrResult.blocks;
// ← nextBlocks.length DEVE SER > 0
```

**Como verificar**:
```javascript
// DevTools:
const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
console.log({
  status: stage.dataset.knexreadModularTextStatus,      // "ready" ou "error"
  blockCount: stage.dataset.knexreadModularNativeTextBlockCount,  // > 0
  reason: stage.dataset.knexreadModularTextReason,      // "native-text-ready" ou "ocr"
});
```

**Se falhar** → Extração de texto falhou silenciosamente

---

### ✓ Ponto 3: HTML Layer Sendo Montada?

**Arquivo**: `PdfModularPageStage.tsx` (linha ~200)

**O que deve estar acontecendo**:
```typescript
const hasHtmlText = visualTextModel.runs.length > 0;

return (
  <div data-knexread-modular-page-stage="true">
    <div className="absolute inset-0 z-0">
      <PdfCanvasLayer ... renderText={!hasHtmlText} />
    </div>

    {hasHtmlText ? (  // ← Isso deve ser TRUE
      <div className="absolute inset-0 z-[5]">
        <PdfHtmlTextLayer model={visualTextModel} />
      </div>
    ) : null}
  </div>
);
```

**Como verificar**:
```javascript
// DevTools Inspector:
// Procure por: <div data-knexread-html-text-layer="true">
// Se existe: Layer montada ✅
// Se não existe: Layer não montada ❌

document.querySelector('[data-knexread-html-text-layer="true"]')
  ? console.log("HTML Layer: MONTADA ✅")
  : console.log("HTML Layer: NÃO MONTADA ❌");
```

**Se falhar** → `visualTextModel.runs.length === 0` (sem blocos extraídos)

---

### ✓ Ponto 4: Spans HTML Sendo Renderizados?

**Arquivo**: `PdfHtmlTextLayer.tsx` (linha ~20)

**O que deve estar acontecendo**:
```typescript
export function PdfHtmlTextLayer({ model, highlightedRunIds, className }: PdfHtmlTextLayerProps) {
  return (
    <div className="knex-pdf-html-text-layer" ... >
      {model.runs.map((run) => (  // ← Deve iterarN vezes
        <span
          key={run.id}
          data-knexread-html-text-run="true"
          style={{
            ...createPdfTextRunStyle(run),  // ← Estilos CSS aplicados
            // position: absolute
            // left: Xpx
            // top: Ypx
            // fontSize: Zpx
            // ...
          }}
        >
          {run.text}  // ← Texto aparece aqui
        </span>
      ))}
    </div>
  );
}
```

**Como verificar**:
```javascript
// DevTools:
const spans = document.querySelectorAll('[data-knexread-html-text-run="true"]');
console.log("Total spans:", spans.length);
console.log("First span text:", spans[0]?.textContent);
console.log("First span styles:", spans[0]?.style.cssText);

// Deve mostrar:
// position: absolute; left: XXpx; top: YYpx; font-size: ZZpx; ...
```

**Se falhar** → `model.runs` estava vazio

---

### ✓ Ponto 5: Z-Index Correto (HTML Acima de Canvas)?

**Arquivo**: `PdfModularPageStage.tsx` (linha ~180)

**O que deve estar acontecendo**:
```typescript
// Canvas layer
<div className="absolute inset-0 z-0">  {/* ← z-0 */}
  <PdfCanvasLayer ... />
</div>

// HTML text layer
<div className="absolute inset-0 z-[5]">  {/* ← z-[5] = 50 */}
  <PdfHtmlTextLayer ... />
</div>

// Resultado: HTML (z=50) está ACIMA de Canvas (z=0)
```

**Como verificar**:
```javascript
// DevTools Inspector (Elements):
// 1. Selecione o canvas: <canvas>
// 2. Na aba Computed, procure por z-index
// 3. Deve ser: 0

// 4. Selecione HTML text layer: <div data-knexread-html-text-layer>
// 5. Na aba Computed, procure por z-index
// 6. Deve ser: 50 (Tailwind z-[5])

const canvas = document.querySelector('canvas');
const htmlLayer = document.querySelector('[data-knexread-html-text-layer="true"]');

console.log("Canvas z-index:", window.getComputedStyle(canvas.parentElement).zIndex);
console.log("HTML z-index:", window.getComputedStyle(htmlLayer).zIndex);
// Canvas < HTML é o esperado
```

**Se falhar** → Z-index invertido ou não aplicado

---

## 📊 Matriz de Diagnóstico

| Ponto | Verificação | Esperado | Seu Resultado | Status |
|-------|-------------|----------|---------------|--------|
| 1 | Pipeline mode | `single-canvas-html-text` | ? | ☐ |
| 2 | Text extraction | `blockCount > 0` | ? | ☐ |
| 3 | HTML layer mount | `querySelector(...) !== null` | ? | ☐ |
| 4 | HTML spans count | `> 0 spans` | ? | ☐ |
| 5 | Z-index order | `html > canvas` | ? | ☐ |

**Todos ☑ = Texto deve aparecer com qualidade**  
**Algum ☐ = Investigar aquele ponto**

---

## 🎯 Árvore de Decisão (Decision Tree)

```
INÍCIO: Texto aparece rasterizado?
│
├─ Ponto 1: render-mode === "single-canvas-html-text"?
│  ├─ NÃO → PDF.js 2.x (legacy)
│  │  └─ SOLUÇÃO: Nada a fazer (compatibilidade)
│  │  └─ Esperado que use tiles
│  │
│  └─ SIM → Ponto 2
│
├─ Ponto 2: blockCount > 0?
│  ├─ NÃO → Extração falhou
│  │  └─ Possíveis causas:
│  │     ├─ PDF não tem texto nativo
│  │     ├─ OCR não executou (ou falhou)
│  │     └─ SOLUÇÃO: Verificar console para erros
│  │
│  └─ SIM → Ponto 3
│
├─ Ponto 3: HTML layer elemento existe?
│  ├─ NÃO → Layer não foi montada
│  │  └─ SOLUÇÃO: Verificar por quê visualTextModel.runs === 0
│  │
│  └─ SIM → Ponto 4
│
├─ Ponto 4: <span data-knexread-html-text-run> count > 0?
│  ├─ NÃO → Spans não renderizados
│  │  └─ SOLUÇÃO: Verificar model.runs na PdfHtmlTextLayer
│  │
│  └─ SIM → Ponto 5
│
├─ Ponto 5: z-index(HTML) > z-index(Canvas)?
│  ├─ NÃO → HTML escondida por canvas
│  │  └─ SOLUÇÃO: Ajustar z-index em PdfModularPageStage
│  │
│  └─ SIM → ✅ TUDO BEM
│             └─ Texto DEVE aparecer com qualidade
│             └─ Se não aparece: CSS styling problema
```

---

## 🛠️ Ferramentas de Debug

### 1. DevTools Network
```
Se texto vem vazio:
- Abra Network tab
- Procure por erros de rede
- Verifique tamanho dos arquivos extraídos
```

### 2. DevTools Console
```javascript
// Monitore extração em tempo real
const observer = new MutationObserver((mutations) => {
  const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
  console.log("Status:", stage?.dataset.knexreadModularTextStatus);
  console.log("Blocks:", stage?.dataset.knexreadModularNativeTextBlockCount);
});

observer.observe(document.body, {
  attributes: true,
  subtree: true,
  attributeFilter: ['data-knexread-modular-text-status', 'data-knexread-modular-native-text-block-count']
});
```

### 3. DevTools Elements
```
1. Procure por: <div data-knexread-modular-page-stage>
2. Expanda para ver estrutura
3. Procure por: <div data-knexread-html-text-layer>
4. Se existe: layer montada
5. Se não existe: layer não foi criada
```

### 4. DevTools Styles
```
1. Selecione um <span data-knexread-html-text-run>
2. Na aba Styles, verifique:
   - position: absolute ✓
   - left: Xpx ✓
   - top: Ypx ✓
   - font-size: Zpx ✓
3. Se falta algum: CSS styling problem
```

---

## 📝 Exemplo de Saída Correta

```javascript
// DevTools Console Output (Esperado)

Pipeline: single-canvas-html-text ✅
Stage: MODULAR ✅
Blocks: 342 ✅
Runs: 342 ✅

Canvas z-index: 0 ✅
HTML z-index: 50 ✅

First HTML Span:
  Text: "Lorem ipsum dolor"
  Position: absolute
  Left: 72.5px
  Top: 144.2px
  Font-size: 12px
  Font-family: "Helvetica"

RESULTADO FINAL: ✅ Texto deve aparecer com qualidade vetorial
```

---

## 🚨 Cenários de Falha Comuns

### Cenário A: Tudo está OK, mas texto ainda não aparece
**Causa provável**: Opacity, display, ou visibility escondendo o layer

```javascript
// Verifique:
const htmlLayer = document.querySelector('[data-knexread-html-text-layer="true"]');
const computedStyle = window.getComputedStyle(htmlLayer);
console.log({
  display: computedStyle.display,      // Não deve ser "none"
  opacity: computedStyle.opacity,      // Não deve ser "0"
  visibility: computedStyle.visibility, // Não deve ser "hidden"
  pointerEvents: computedStyle.pointerEvents, // "auto" esperado
});
```

### Cenário B: Blocos extraídos, mas spans não renderizam
**Causa provável**: buildPdfVisualTextModel falhou

```javascript
// Verifique o modelo:
const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
// Adicione logger dentro de PdfVisualTextModelBuilder
// para ver o que entra e sai
```

### Cenário C: Canvas renderizando com texto sobreposto
**Causa provável**: renderText={!hasHtmlText} não aplicado

```javascript
// Verifique:
const canvas = document.querySelector('canvas');
console.log(canvas?.getAttribute('data-knexPdfCanvasTextMode'));
// Deve ser: "without-text"
// Se "normal": texto ainda sendo renderizado no canvas
```

---

## ✅ Checklist Final

Execute EXATAMENTE nesta ordem:

```javascript
console.log("🔍 KnexRead Text Quality Diagnostic\n");

// 1
const mode = document.querySelector('[data-knexread-page-render-mode]')?.dataset.knexreadPageRenderMode;
console.log("1️⃣ Pipeline:", mode, mode === "single-canvas-html-text" ? "✅" : "❌");

// 2
const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
const blocks = parseInt(stage?.dataset.knexreadModularNativeTextBlockCount || 0);
console.log("2️⃣ Text Blocks:", blocks, blocks > 0 ? "✅" : "❌");

// 3
const htmlLayer = document.querySelector('[data-knexread-html-text-layer="true"]');
console.log("3️⃣ HTML Layer:", htmlLayer ? "✅ Mounted" : "❌ Not mounted");

// 4
const spans = document.querySelectorAll('[data-knexread-html-text-run="true"]').length;
console.log("4️⃣ HTML Spans:", spans, spans > 0 ? "✅" : "❌");

// 5
const htmlZ = window.getComputedStyle(htmlLayer || {}).zIndex;
const canvasZ = parseInt(window.getComputedStyle(document.querySelector('[data-knexread-modular-canvas-host]') || {}).zIndex || 0);
const zOk = parseInt(htmlZ) > canvasZ;
console.log("5️⃣ Z-Index:", `HTML(${htmlZ}) > Canvas(${canvasZ})`, zOk ? "✅" : "❌");

console.log("\n" + (mode === "single-canvas-html-text" && blocks > 0 && htmlLayer && spans > 0 && zOk ? "✅ ALL OK - Texto deve aparecer!" : "❌ ALGUM PROBLEMA - Verificar acima"));
```

---

**Gerado**: 01/06/2026 - KnexRead Debug Checklist
