# 🎯 Resumo Executivo - Arquitetura de Renderização KnexRead

**Você perguntou**: Onde estão os arquivos de renderização? Por que texto ainda aparece rasterizado?

---

## 🗂️ Resposta Rápida: Localização dos Arquivos

### Existe um PIPELINE DUPLO:

```
NOVO (Modular - Qualidade Alta)          LEGADO (Tiles - Compatibilidade)
src/modules/Knexread/rendering/          src/modules/Knexread/native-pdf-reader/
  ├─ composition/                           └─ components/
  │  └─ PdfModularPageStage.tsx ⭐          ├─ pdf-tiles/
  │                                         │  └─ PdfTiledPageCanvas.tsx
  ├─ canvas/                                │     (Renderiza texto rasterizado)
  │  └─ PdfCanvasLayer.tsx ⭐               │
  │                                         └─ PdfPageView.tsx
  └─ text/                                     └─ ROUTER (decide qual usar)
     ├─ PdfHtmlTextLayer.tsx ⭐
     ├─ PdfTextCssFactory.ts ⭐
     └─ PdfVisualTextModelBuilder.ts ⭐
```

---

## ⭐ 7 Arquivos Críticos para Entender o Problema

| # | Arquivo | O Quê Faz | Problema? |
|---|---------|-----------|-----------|
| 1 | **PdfPageView.tsx** | ROUTER: decide modular vs legado | 🔴 Se não escolhe modular = texto rasterizado |
| 2 | **PdfModularPageStage.tsx** | ORQUESTRA: extração + renderização | 🔴 Se extração falha = sem texto |
| 3 | **PdfCanvasLayer.tsx** | RENDERIZA CANVAS sem texto | 🔴 Se não filtra texto = sobrepõe HTML |
| 4 | **PdfHtmlTextLayer.tsx** | RENDERIZA SPANS HTML | 🔴 Se não monta = texto não aparece |
| 5 | **PdfTextCssFactory.ts** | GERA ESTILOS CSS | 🔴 Se estilos errados = texto invisível/desalinhado |
| 6 | **PdfVisualTextModelBuilder.ts** | CONSTRÓI MODELO VISUAL | 🔴 Se modelo vazio = sem HTML text |
| 7 | **pdfLoader.service.ts** | DETECTA SE PDF É LEGADO | 🔴 Se detecta legado = usa tiles (rasterizado) |

---

## 🎯 Por Que Texto Aparece Rasterizado? (4 Razões)

### ❌ Razão 1: Pipeline Legado Ativo (PDF.js 2.x)
```
session.isLegacy === true
  ↓
PdfTiledPageCanvas renderizado
  ↓
Tiles 16x2 com texto rasterizado aparecem
```
**Solução**: Atualizar PDF.js para versão 3.x+

---

### ❌ Razão 2: Extração de Texto Falhou
```
PdfNativeTextExtractor retorna []
  ↓
OCR não executado ou falhou
  ↓
textBlocks.length === 0
  ↓
PdfHtmlTextLayer não é montada
  ↓
Canvas com texto rasterizado aparece
```
**Solução**: Verificar logs de erro em PdfModularPageStage

---

### ❌ Razão 3: HTML Layer Está Embaixo do Canvas
```
PdfHtmlTextLayer EXISTE com 500+ spans
  ├─ Mas z-index está ERRADO
  └─ Canvas (z-0) está ACIMA de HTML (z-?)
  ↓
HTML escondida, canvas visível
  ↓
Texto rasterizado do canvas aparece
```
**Solução**: Verificar z-index em PdfModularPageStage.tsx

---

### ❌ Razão 4: Canvas Ainda Renderizando Texto
```
renderText prop = false (correto)
  ├─ Mas operação filter de texto NÃO FUNCIONOU
  └─ PDF.js renderizou texto no canvas mesmo assim
  ↓
Texto rasterizado no canvas + CSS do HTML
  ↓
Texto rasterizado aparece (mais escuro/borrado)
```
**Solução**: Debugar PdfCanvasLayer operation filter

---

## 🔍 Como Diagnosticar (Em 1 Minuto)

Cole no **DevTools Console** (F12):

```javascript
const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
const runs = document.querySelectorAll('[data-knexread-html-text-run="true"]');
const mode = document.querySelector('[data-knexread-page-render-mode]')?.dataset.knexreadPageRenderMode;

console.log('1. Pipeline:', mode);                          // single-canvas-html-text?
console.log('2. Blocos extraídos:', stage?.dataset.knexreadModularNativeTextBlockCount);  // > 0?
console.log('3. HTML layer montada:', runs.length);         // > 0?
console.log('4. Primeiro span text:', runs[0]?.textContent.slice(0, 30));
console.log('5. Primeiro span z-index:', window.getComputedStyle(runs[0]).zIndex);

if (mode === 'single-canvas-html-text' && runs.length > 0) {
  console.log('✅ Esperado texto HTML com qualidade');
} else {
  console.log('❌ Algo errado - verificar acima');
}
```

---

## 📊 Arquitetura Visual (Fluxo Completo)

```
USUÁRIO CARREGA PDF
  ↓
PdfPageView.tsx (linha 1300+)
  ├─ Verifica: session.isLegacy?
  │
  ├─ SIM (PDF.js 2.x)
  │  └─ PdfTiledPageCanvas (LEGADO)
  │     ├─ Renderiza 16x2 grid tiles
  │     ├─ Texto rasterizado no canvas
  │     └─ Z-stack: z-0 tiles + z-20 invisible text
  │
  └─ NÃO (PDF.js 3.x+) ⭐ NOVO
     └─ PdfModularPageStage.tsx (ORQUESTRA)
        │
        ├─ Extrai Texto
        │  ├─ PdfNativeTextExtractor (rápido)
        │  ├─ Se vazio: PdfOcrPipeline (OCR)
        │  └─ Resultado: KnexPdfTextBlock[]
        │
        ├─ Constrói Visual Model
        │  └─ PdfVisualTextModelBuilder.ts
        │     └─ Resultado: PdfVisualTextModel { runs[] }
        │
        └─ Renderiza 2 Camadas
           │
           ├─ Camada 1 (z-0): Canvas
           │  └─ PdfCanvasLayer.tsx
           │     ├─ Renderiza PDF sem texto
           │     └─ Passa renderText={!hasHtmlText}
           │
           └─ Camada 2 (z-[5]): HTML Text
              └─ PdfHtmlTextLayer.tsx
                 ├─ model.runs.map(run => <span>)
                 ├─ Estilos via PdfTextCssFactory.ts
                 └─ Texto VETORIAL com qualidade ✅
```

---

## 🎨 Z-Index Stack (O Que Cobre O Quê)

```
Z-50  Debug Overlay (opcional)
  ↑
Z-[5] ⭐ HTML TEXT LAYER
  ↑ (está ACIMA do canvas)
  │
Z-0   Canvas
  ↑ (embaixo, rasterização do PDF)
  │
-     Container Page
```

**Esperado**: HTML text (vetorial) está VISÍVEL acima do canvas  
**Se errado**: Canvas visível acima do HTML (texto rasterizado aparece)

---

## 🔧 Pontos de Falha Mais Comuns

### 1️⃣ HTML Layer Não Está Sendo Montada
**Sintoma**: `document.querySelectorAll('[data-knexread-html-text-run]').length === 0`

**Causa**:
- Extração de texto retornou 0 blocos
- OCR não executou

**Onde verificar**:
```javascript
const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
console.log(stage.dataset.knexreadModularTextStatus);  // "error"?
console.log(stage.dataset.knexreadModularTextReason);  // Por quê?
```

**Arquivo**: [PdfModularPageStage.tsx](src/modules/Knexread/rendering/composition/PdfModularPageStage.tsx) linha ~130-160

---

### 2️⃣ Z-Index Invertido
**Sintoma**: HTML layer existe mas não está visível

**Onde verificar**:
```javascript
const htmlZ = window.getComputedStyle(document.querySelector('[data-knexread-html-text-layer]')).zIndex;
const canvasZ = window.getComputedStyle(document.querySelector('canvas')).zIndex;
console.log('HTML:', htmlZ, 'Canvas:', canvasZ); // htmlZ < canvasZ = problema!
```

**Arquivo**: [PdfModularPageStage.tsx](src/modules/Knexread/rendering/composition/PdfModularPageStage.tsx) linha ~180-210

---

### 3️⃣ Canvas Ainda Renderizando Texto
**Sintoma**: Texto rasterizado aparece sobreposto com HTML

**Onde verificar**:
```javascript
const canvas = document.querySelector('canvas');
console.log(canvas.getAttribute('data-knexPdfCanvasTextMode'));
// "without-text" = OK
// "normal" = PROBLEMA (texto ainda no canvas)
```

**Arquivo**: [PdfCanvasLayer.tsx](src/modules/Knexread/rendering/canvas/PdfCanvasLayer.tsx) linha ~150-200

---

### 4️⃣ PDF.js 2.x (Legado)
**Sintoma**: Sempre renderiza tiles rasterizados

**Onde verificar**:
```javascript
const mode = document.querySelector('[data-knexread-page-render-mode]').dataset.knexreadPageRenderMode;
console.log(mode); // "tiled-canvas" = legado
```

**Arquivo**: [pdfLoader.service.ts](src/modules/Knexread/native-pdf-reader/services/pdfLoader.service.ts) linha ~130-145

---

## 📍 Localização de Cada Arquivo

| Arquivo | Caminho Completo | Linhas Críticas |
|---------|-----------------|-----------------|
| Router Principal | `native-pdf-reader/components/PdfPageView.tsx` | 1300-1500 |
| Orquestrador | `rendering/composition/PdfModularPageStage.tsx` | 70-220 |
| Canvas Layer | `rendering/canvas/PdfCanvasLayer.tsx` | 1-50, 150-200 |
| HTML Text Layer | `rendering/text/PdfHtmlTextLayer.tsx` | 1-60 |
| CSS Factory | `rendering/text/PdfTextCssFactory.ts` | 1-100 |
| Visual Builder | `rendering/text/PdfVisualTextModelBuilder.ts` | 1-80 |
| Legacy Detector | `native-pdf-reader/services/pdfLoader.service.ts` | 130-145, 360-380 |
| Legacy Fallback | `native-pdf-reader/components/pdf-tiles/PdfTiledPageCanvas.tsx` | - |

---

## 🚀 Próximo Passo: Execute o Diagnóstico

1. **Abra DevTools** (F12)
2. Vá até **Console**
3. Cole o script de diagnóstico acima
4. **Compartilhe o output comigo**

Com o resultado, posso:
- Identificar EXATAMENTE por que texto aparece rasterizado
- Apontar qual arquivo tem o problema
- Fornecer correção específica

---

## 📚 Documentação Completa Criada

1. **RENDERING_ARCHITECTURE_MAP.md** - Arquitetura completa com diagramas
2. **FILES_LOCATION_MAP.md** - Mapa visual de localização dos arquivos
3. **DEBUG_CHECKLIST.md** - Guia passo a passo de diagnóstico
4. **ACTIVATION_SUMMARY.md** - Como ativação automática funciona

Todos em: `src/modules/Knexread/`

---

**Status**: ✅ Pronto para diagnóstico  
**Próximo**: Execute script de diagnóstico e compartilhe resultado
