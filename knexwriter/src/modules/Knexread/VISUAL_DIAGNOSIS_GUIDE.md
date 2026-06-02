# 🎯 Por Que Texto Aparece Rasterizado? - Guia Visual Completo

---

## 📍 A Arquitetura Em 1 Imagem

```
┌─────────────────────────────────────────────────────────────────┐
│                         PDF CARREGADO                           │
│                                                                 │
│  session.isLegacy = true or false?                             │
└─────────────────────────────────────────┬───────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
            ❌ Legado (true)                          ✅ Moderno (false)
            PDF.js 2.x                               PDF.js 3.x+
                    │                                           │
                    ▼                                           ▼
        ┌───────────────────────┐            ┌──────────────────────────┐
        │ PdfTiledPageCanvas    │            │ PdfModularPageStage      │
        │ (Compatibilidade)     │            │ (Qualidade)              │
        │                       │            │                          │
        │ • 16x2 tiles          │            │ 1️⃣ Extrai texto         │
        │ • Texto rasterizado   │            │    (nativo + OCR)        │
        │ • Qualidade: média    │            │                          │
        │                       │            │ 2️⃣ Constrói modelo      │
        │ Z-Stack:              │            │    visual                │
        │ • z-0: tiles          │            │                          │
        │ • z-20: invisible     │            │ 3️⃣ Renderiza camadas:   │
        │        text layer     │            │                          │
        └───────────────────────┘            │    ┌────────────────┐    │
                ▼                            │    │ Z-[5] HTML     │    │
        📋 Resultado Final:                  │    │ Texto          │    │
        ❌ Rasterizado (blurry)              │    │ (QUALIDADE) ⭐ │    │
        ❌ Sem seleção fácil                │    │                │    │
        ✅ Compatível                       │    │ Z-0 Canvas     │    │
        ✅ Progressive                      │    │ (sem texto)    │    │
                                            │    └────────────────┘    │
                                            └──────────────────────────┘
                                                    ▼
                                            📋 Resultado Final:
                                            ✅ Vetorial (sharp)
                                            ✅ Selecionável
                                            ✅ Interativo
```

---

## 🔴 Os 4 Problemas Que Causam Texto Rasterizado

### Problema 1: Pipeline Legado Ativado
```
❌ session.isLegacy = true
   └─ PdfTiledPageCanvas renderizado
      └─ Tiles com TEXTO RASTERIZADO
```
📍 Verificar: `PdfPageView.tsx` linha 1300+

---

### Problema 2: Extração Falhou (0 Blocos)
```
✅ Modular pipeline ativado
❌ Mas textBlocks.length = 0
   └─ PdfHtmlTextLayer NÃO É MONTADA
      └─ Canvas com TEXTO RASTERIZADO aparece
```
📍 Verificar: `PdfModularPageStage.tsx` linha 130-160

---

### Problema 3: HTML Layer Embaixo do Canvas
```
✅ Modular pipeline ativado
✅ textBlocks > 0
✅ PdfHtmlTextLayer MONTADA
❌ Mas z-index invertido
   └─ Canvas (z-0) está ACIMA de HTML
      └─ HTML escondida
         └─ TEXTO RASTERIZADO DO CANVAS VISÍVEL
```
📍 Verificar: `PdfModularPageStage.tsx` linha 180-210

---

### Problema 4: Canvas Renderizando Texto
```
✅ Modular pipeline ativado
✅ textBlocks > 0
✅ HTML Layer z-index correto
❌ Mas canvas.operationFilter FALHOU
   └─ Texto ainda renderizado no canvas
      └─ HTML text + TEXTO RASTERIZADO DO CANVAS
         └─ Aparece texto rasterizado (mais escuro)
```
📍 Verificar: `PdfCanvasLayer.tsx` linha 150-200

---

## 🧠 Qual Problema Você Tem?

### Teste Rápido 1: Qual pipeline está ativo?
```javascript
const mode = document.querySelector('[data-knexread-page-render-mode]')?.dataset.knexreadPageRenderMode;
console.log(mode);

// Resultado:
// "single-canvas-html-text" = MODULAR ✅
// "tiled-canvas" = LEGADO ❌
```

**Se LEGADO**:
```
Você tem PROBLEMA 1
Solução: Atualizar PDF.js para 3.x+
```

**Se MODULAR**:
```
Vai para Teste 2
```

---

### Teste Rápido 2: Blocos foram extraídos?
```javascript
const stage = document.querySelector('[data-knexread-modular-page-stage="true"]');
const blocks = parseInt(stage?.dataset.knexreadModularNativeTextBlockCount || 0);
console.log(blocks);

// Resultado:
// > 0: Blocos extraídos ✅
// 0: Nenhum bloco ❌
```

**Se 0 BLOCOS**:
```
Você tem PROBLEMA 2
Solução: Debugar PdfNativeTextExtractor ou OCR
Verificar: stage.dataset.knexreadModularTextStatus = "error"?
```

**Se > 0 BLOCOS**:
```
Vai para Teste 3
```

---

### Teste Rápido 3: HTML Layer foi montada?
```javascript
const htmlLayer = document.querySelector('[data-knexread-html-text-layer="true"]');
console.log(htmlLayer ? "MONTADA ✅" : "NÃO MONTADA ❌");

// Se NÃO MONTADA = Vai para Teste 4
// Se MONTADA = Vai para Teste 5
```

---

### Teste Rápido 4: Quantos HTML spans existem?
```javascript
const runs = document.querySelectorAll('[data-knexread-html-text-run="true"]').length;
console.log(runs);

// Resultado:
// > 0: Spans renderizados ✅
// 0: Nenhum span ❌
```

**Se 0 SPANS**:
```
Você tem PROBLEMA 2 (ainda)
Razão: visualTextModel.runs estava vazia
Solução: Debugar buildPdfVisualTextModel()
```

**Se > 0 SPANS**:
```
Vai para Teste 5
```

---

### Teste Rápido 5: Z-Index Está Correto?
```javascript
const htmlZ = parseInt(window.getComputedStyle(document.querySelector('[data-knexread-html-text-layer]')).zIndex);
const canvasZ = parseInt(window.getComputedStyle(document.querySelector('canvas')).zIndex);
console.log(`HTML: ${htmlZ}, Canvas: ${canvasZ}`, htmlZ > canvasZ ? "✅" : "❌");

// Resultado:
// htmlZ > canvasZ: CORRETO ✅
// htmlZ <= canvasZ: ERRADO ❌
```

**Se ERRADO**:
```
Você tem PROBLEMA 3
Solução: Ajustar z-index em PdfModularPageStage.tsx
Esperado: HTML = z-[5] (50), Canvas = z-0 (0)
```

**Se CORRETO**:
```
Vai para Teste 6
```

---

### Teste Rápido 6: Canvas Renderizando Texto?
```javascript
const canvas = document.querySelector('canvas');
const textMode = canvas?.getAttribute('data-knexPdfCanvasTextMode');
console.log(textMode);

// Resultado:
// "without-text": CORRETO ✅
// "normal": ERRADO ❌
```

**Se ERRADO**:
```
Você tem PROBLEMA 4
Solução: Debugar operationFilter em PdfCanvasLayer.tsx
```

**Se CORRETO**:
```
✅ TUDO CORRETO!
Você DEVERIA estar vendo texto HTML com qualidade
Se não está: Problema de CSS ou display
```

---

## 🎯 Árvore de Decisão Completa

```
INÍCIO
│
├─ É pipeline "single-canvas-html-text"?
│  ├─ NÃO → PROBLEMA 1: Pipeline legado
│  │         Solução: Atualizar PDF.js
│  │
│  └─ SIM ✓
│
├─ Blocos > 0?
│  ├─ NÃO → PROBLEMA 2: Extração falhou
│  │         Solução: Debugar extraction pipeline
│  │
│  └─ SIM ✓
│
├─ HTML Layer elemento existe?
│  ├─ NÃO → PROBLEMA 2: Model vazio
│  │         Solução: Debugar buildPdfVisualTextModel
│  │
│  └─ SIM ✓
│
├─ HTML Spans > 0?
│  ├─ NÃO → PROBLEMA 2: Spans não renderizados
│  │         Solução: Verificar model.runs
│  │
│  └─ SIM ✓
│
├─ Z-Index(HTML) > Z-Index(Canvas)?
│  ├─ NÃO → PROBLEMA 3: Z-index invertido
│  │         Solução: Ajustar z-index
│  │
│  └─ SIM ✓
│
├─ Canvas renderizando sem texto?
│  ├─ NÃO → PROBLEMA 4: Texto no canvas
│  │         Solução: Debugar operation filter
│  │
│  └─ SIM ✓
│
└─ ✅ TUDO OK!
   Texto DEVE aparecer com qualidade
   (Se ainda não aparece: problema CSS ou display)
```

---

## 📊 Resumo: Qual Arquivo Verificar?

| Seu Sintoma | Problema | Arquivo | Linhas |
|-------------|----------|---------|--------|
| Sempre renderiza tiles | 1 | PdfPageView.tsx | 1300-1500 |
| Texto não está visível | 2 | PdfModularPageStage.tsx | 130-160 |
| HTML está embaixo | 3 | PdfModularPageStage.tsx | 180-210 |
| Texto sobreposto borrado | 4 | PdfCanvasLayer.tsx | 150-200 |

---

## 🚀 O Que Fazer AGORA

1. **Execute Teste 1** (qual pipeline)
2. **Se LEGADO**: Pronto, é compatibilidade. Nada a fazer.
3. **Se MODULAR**: Execute Testes 2-6 sequencialmente
4. **Identifique qual problema**
5. **Compartilhe comigo qual teste falhou**

Exemplo de resultado esperado:

```javascript
// BELO (esperado)
Pipeline: single-canvas-html-text ✅
Blocks: 342 ✅
HTML Layer: MONTADA ✅
Spans: 342 ✅
Z-Index: HTML(50) > Canvas(0) ✅
Canvas Mode: without-text ✅

RESULTADO: ✅ Texto deve aparecer com qualidade
```

---

## 🎓 Entender a Arquitetura

```
PdfPageView.tsx
    ↓
    ├─ Detecta: session.isLegacy?
    │
    ├─ SIM → PdfTiledPageCanvas (tiles, rasterizado)
    │
    └─ NÃO → PdfModularPageStage
             │
             ├─ PdfNativeTextExtractor (rápido)
             ├─ PdfOcrPipeline (fallback)
             │ → KnexPdfTextBlock[]
             │
             ├─ PdfVisualTextModelBuilder
             │ → PdfVisualTextModel { runs[] }
             │
             └─ Renderiza:
                ├─ PdfCanvasLayer (z-0, sem texto)
                └─ PdfHtmlTextLayer (z-[5], HTML)
                   ├─ model.runs.map(run => <span>)
                   ├─ Estilos: PdfTextCssFactory
                   └─ Resultado: TEXTO VETORIAL ✅
```

---

## 🎯 Objetivo Final

**Quando tudo funciona**:
- ✅ PDF carregado com PDF.js 3.x+
- ✅ Texto extraído (nativo ou OCR)
- ✅ HTML spans renderizados
- ✅ Z-index correto (HTML acima)
- ✅ Canvas sem texto sobreposto
- ✅ **RESULTADO**: Texto vetorial com qualidade ALTA, totalmente interativo

---

**Próximo**: Execute os 6 testes rápidos e compartilhe qual falha!
