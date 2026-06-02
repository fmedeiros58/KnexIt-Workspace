# 🏗️ AUDITORIA COMPLETA - KnexRead Blueprint Architecture

**Data**: 01/06/2026  
**Status**: ✅ Mapeamento Arquitetural Completo  
**Objetivo**: Reconstrução baseada em Blueprint (não rasterização)

---

## 📊 RESUMO EXECUTIVO

### Situação Atual
- ✅ **Pipeline Modular** (PDF.js 3.x+): Canvas rasterizado + HTML text sobreposto
- ✅ **Pipeline Legado** (PDF.js 2.x): 16×2 tiles com texto
- ❌ **Problema**: PDF renderizado como imagem = baixa qualidade de texto
- ❌ **Duplicação**: Texto no canvas + HTML sobreposto = visual ruim

### Nova Direção (Blueprint)
```
PDF Carregado
  ↓
Extração Estrutural (sem rasterização)
  ├─ Texto extraído → KnexPdfTextBlock[]
  ├─ Imagens extraídas → KnexPdfImageElement[]
  ├─ Formas/Vetores → KnexPdfShapeElement[]
  ├─ Campos de Formulário → KnexPdfFormField[]
  └─ Anotações → KnexPdfAnnotation[]
  ↓
Criar Blueprint (representação reconstruível)
  └─ KnexPdfPageBlueprint { textRuns, nonTextElements, metadata }
  ↓
Renderizar Blueprint em Superfície DOM
  ├─ Texto: HTML real (sem rasterização)
  ├─ Imagens: IMG tags ou SVG
  ├─ Formas: SVG paths ou divs estilizados
  └─ Resultado: Página reconstruída (não bitmap)
```

---

## 🎯 ARQUITETURA ATUAL (O QUE MAPEAR)

### 1. **Renderização de Canvas** (PRECISA EVOLUIR)

| Arquivo | Responsabilidade | Localização |
|---------|------------------|-------------|
| `BlankCanvasBuilder.ts` | Cria canvas com dimensões corretas | `rendering/canvas/` |
| `PdfCanvasLayer.tsx` | Renderiza página SEM texto no canvas | `rendering/canvas/` |
| `PdfSingleCanvasRenderer.ts` | Orquestra renderização do canvas | `rendering/canvas/` |
| `PdfModularPageStage.tsx` | ORQUESTRA TUDO (extração + renderização) | `rendering/composition/` |
| `PdfPageComposition.tsx` | Compõe camadas (canvas + HTML) | `rendering/composition/` |

**Problema**: Canvas renderiza TUDO (inclusive texto), depois HTML sobrepõe. Resultado: texto rasterizado + HTML = visual ruim.

**Solução**: Canvas renderiza SÓ não-texto (imagens, formas). Texto vem APENAS do HTML.

---

### 2. **Extração de Texto** (PRESERVAR, ESTENDER)

| Arquivo | Responsabilidade | Localização |
|---------|------------------|-------------|
| `PdfNativeTextExtractor.ts` | Extrai texto nativo via PDF.js | `extraction/native-text/` |
| `PdfOcrPipeline.ts` | OCR fallback (se texto vazio) | `extraction/ocr/` |
| `PdfOcrNeedDetector.ts` | Detecta quando OCR é necessário | `extraction/ocr/` |
| `PdfVisualTextModelBuilder.ts` | Converte blocos em modelo visual | `rendering/text/` |

**Status**: ✅ Completo e funcional

**O que estender**: Adicionar extração de:
- Imagens (atualmente rasterizadas no canvas)
- Formas/Vetores (PDF drawing operations)
- Campos de formulário
- Anotações (já parcialmente extraídas)

---

### 3. **Camada de Texto HTML** (USAR COMO BASE)

| Arquivo | Responsabilidade | Localização |
|---------|------------------|-------------|
| `PdfHtmlTextLayer.tsx` | Renderiza `<span>` com texto | `rendering/text/` |
| `PdfTextCssFactory.ts` | Gera CSS (position, font, color) | `rendering/text/` |

**Status**: ✅ Funcionando, mas apenas para texto

**O que reutilizar**: Padrão de CSS posicionamento absoluto → aplica a TODOS elementos (texto, imagens, formas)

---

### 4. **Tipos & Contratos** (PRESERVAR COMPLETAMENTE)

| Arquivo | Tipos Definidos | Localização |
|---------|-----------------|-------------|
| `KnexPdfTypes.ts` | `KnexPdfPageGeometry`, `KnexPdfRenderScale`, `KnexPdfViewport`, `KnexPdfTextBlock`, `KnexPdfAnnotation` | `core/` |
| `KnexPdfRenderContracts.ts` | `IKnexPdfPageRenderer`, `IKnexPdfBackend`, `IKnexPdfRenderManager` | `core/` |
| `KnexPdfGeometry.ts` | `KnexPdfCoordinateConverter`, `KnexPdfViewportManager` | `core/` |
| `engineTypes.ts` | `KnexPdfBackendId = "pdfjs" \| "pdfium"` | `knex-pdf-engine/core/` |
| `RenderQualityController.ts` | Calcula `outputScale` baseado em qualidade | `knex-pdf-engine/rendering/` |

**Status**: ✅ Estável, não quebrar

---

### 5. **Componentes Principais** (HIERARQUIA)

```
PdfPageView.tsx (ROUTER PRINCIPAL)
  │
  ├─ Verifica: session.isLegacy?
  │
  ├─ SIM → PdfTiledPageCanvas (LEGADO)
  │  └─ 16×2 tiles (preservar como fallback)
  │
  └─ NÃO → PdfModularPageStage (NOVO/MODULAR)
     │
     ├─ Extrai texto via:
     │  ├─ PdfNativeTextExtractor
     │  ├─ PdfOcrPipeline (fallback)
     │  └─ buildPdfVisualTextModel()
     │
     ├─ Renderiza 2 camadas:
     │  ├─ PdfCanvasLayer (z-0) ← Canvas com PDF (SEM texto)
     │  └─ PdfHtmlTextLayer (z-[5]) ← Spans com texto
     │
     ├─ Opcionais:
     │  ├─ PdfAnnotationLayer (z-10/30)
     │  ├─ PdfHighlightLayer (z-40)
     │  └─ PdfDebugOverlay (z-50)
```

---

## 🔧 O QUE PODE SER ALTERADO COM SEGURANÇA

### ✅ EVOLUIR (Seguro refatorar)

| Arquivo | Por Quê | Impacto |
|---------|---------|--------|
| `PdfCanvasLayer.tsx` | Renderizar APENAS não-texto | Baixo (já isola lógica) |
| `PdfModularPageStage.tsx` | Adicionar extração de elementos | Baixo (estende, não quebra) |
| `PdfHtmlTextLayer.tsx` | Reutilizar para TODOS elementos | Baixo (padrão CSS já existe) |
| `PdfTextCssFactory.ts` | Criar equivalente para imagens/formas | Baixo (novo, não quebra) |

### ⚠️ PRESERVAR (Crítico)

| Arquivo | Por Quê | Impacto |
|---------|---------|---------|
| `KnexPdfTypes.ts` | Define toda a geometria | QUEBRA TUDO se alterar |
| `KnexPdfRenderContracts.ts` | Interfaces dos backends | QUEBRA TUDO se alterar |
| `PdfPageView.tsx` | Roteador principal | QUEBRA TUDO se alterar logic |
| `pdfLoader.service.ts` | Carrega PDF, detecta legacy | QUEBRA TUDO se alterar |

### ✨ CRIAR (Novo, zero risco)

| Arquivo | Propósito | Localização |
|---------|-----------|-------------|
| `KnexPdfBlueprintTypes.ts` | Tipos do blueprint | `core/` |
| `KnexPdfPageBlueprintBuilder.ts` | Extrai elementos → blueprint | `extraction/blueprint/` |
| `KnexPdfBlueprintRenderer.tsx` | Renderiza blueprint em DOM | `rendering/blueprint/` |
| `KnexPdfImageElementExtractor.ts` | Extrai imagens do PDF | `extraction/images/` |
| `KnexPdfShapeExtractor.ts` | Extrai vetores/shapes do PDF | `extraction/shapes/` |

---

## 📐 TIPOS QUE PRECISAM SER CRIADOS

### KnexPdfPageBlueprint (Principal)

```typescript
export interface KnexPdfPageBlueprint {
  // Identificação
  pageIndex: number;
  
  // Dimensões (em CSS pixels)
  cssWidth: number;
  cssHeight: number;
  
  // Dados da página original (em PDF points)
  pageWidthPt: number;
  pageHeightPt: number;
  
  // Rotação (0, 90, 180, 270)
  rotation: number;
  
  // Elementos reconstruíveis
  elements: KnexPdfBlueprintElement[]; // TextRun | Image | Shape | FormField
  
  // Metadados
  extractionMode: "digital" | "ocr" | "hybrid";
  confidence: number; // 0-100
  sourceBackend?: "pdfium" | "pdfjs" | "ocr" | "hybrid";
  extractedAt: number; // timestamp
  
  // Versão do blueprint (para migrations)
  blueprintVersion: "1.0";
}

export type KnexPdfBlueprintElement = 
  | KnexPdfTextRun
  | KnexPdfImageElement
  | KnexPdfShapeElement
  | KnexPdfFormField;

// TEXTO (JÁ EXISTE)
export interface KnexPdfTextRun {
  type: "text";
  id: string;
  text: string;
  x: number; y: number;
  width: number; height: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  color: string;
  opacity: number;
  lineHeight: number;
  letterSpacing: number;
  textDecoration?: "underline" | "line-through";
  baselineOffset?: number;
  transform?: string;
  sourceBackend: "pdfjs" | "ocr" | "hybrid";
  confidence: number;
}

// IMAGEM (NOVO)
export interface KnexPdfImageElement {
  type: "image";
  id: string;
  x: number; y: number;
  width: number; height: number;
  src: string; // data:image/png;base64 ou URL
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  opacity: number;
  transform?: string;
  rotation?: number;
}

// FORMA/VETOR (NOVO)
export interface KnexPdfShapeElement {
  type: "shape";
  id: string;
  shapeType: "rect" | "circle" | "ellipse" | "path" | "line" | "polygon";
  x: number; y: number;
  width: number; height: number;
  fill?: {
    color: string;
    opacity: number;
  };
  stroke?: {
    color: string;
    width: number;
    opacity: number;
    dashArray?: string;
  };
  path?: string; // SVG path data
  points?: Array<[number, number]>; // Para polygon
  transform?: string;
}

// CAMPO DE FORMULÁRIO (NOVO)
export interface KnexPdfFormField {
  type: "form-field";
  id: string;
  fieldType: "text" | "checkbox" | "radio" | "select" | "signature";
  x: number; y: number;
  width: number; height: number;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required: boolean;
  readOnly: boolean;
}
```

---

## 🚀 PLANO DE IMPLEMENTAÇÃO (4 FASES)

### **Fase 1: Criação de Tipos Blueprint** (1-2 dias)
- Criar `core/KnexPdfBlueprintTypes.ts`
- Estender tipos existentes
- **Zero breaking changes**
- **Saída**: Tipos prontos para uso

### **Fase 2: Extração de Elementos** (2-3 dias)
- Criar `extraction/blueprint/KnexPdfPageBlueprintBuilder.ts`
- Estender extração para:
  - Imagens (via canvas pixel extraction ou PDF operations)
  - Formas (via PDF drawing operations)
  - Campos de formulário (via annotations)
- **Saída**: Blueprint com todos elementos

### **Fase 3: Renderização do Blueprint** (2-3 dias)
- Criar `rendering/blueprint/KnexPdfBlueprintRenderer.tsx`
- Renderizar elementos como:
  - Texto: `<span>` com CSS (existente)
  - Imagens: `<img>` tags
  - Formas: SVG inline ou `<canvas>` para complexas
  - Formulários: `<input>`, `<select>`, etc.
- **Saída**: DOM renderizado do blueprint

### **Fase 4: Modo Blueprint Ativável** (1-2 dias)
- Usar blueprint como padrão do palco modular; manter `window.KNEX_PDF_DISABLE_BLUEPRINT_MODE = true` apenas para fallback temporário.
- Fazer PdfModularPageStage usar blueprint quando ativado
- Manter canvas/HTML como fallback
- **Saída**: Modo experimental funcional

---

## 📍 ARQUIVOS CRÍTICOS

### Para Preservar Completamente
```
src/modules/Knexread/
├── core/
│   ├── KnexPdfTypes.ts                    (NÃO TOCAR)
│   ├── KnexPdfRenderContracts.ts          (NÃO TOCAR)
│   ├── KnexPdfGeometry.ts                 (NÃO TOCAR)
│   └── index.ts                           (NÃO TOCAR)
├── native-pdf-reader/
│   ├── services/pdfLoader.service.ts      (NÃO TOCAR - session.isLegacy)
│   ├── components/PdfPageView.tsx         (NÃO TOCAR - router)
│   └── knex-pdf-engine/                   (NÃO TOCAR - engine core)
└── backends/                              (NÃO TOCAR - adapters)
```

### Para Estender com Segurança
```
src/modules/Knexread/
├── rendering/
│   ├── canvas/
│   │   ├── PdfCanvasLayer.tsx             (✅ EVOLUIR)
│   │   └── (criar: PdfCanvasLayerNonText.tsx)
│   ├── text/
│   │   ├── PdfHtmlTextLayer.tsx           (✅ REUTILIZAR PADRÃO)
│   │   └── PdfTextCssFactory.ts           (✅ ESTENDER)
│   └── composition/
│       ├── PdfModularPageStage.tsx        (✅ ESTENDER)
│       └── (criar: PdfBlueprintStage.tsx)
└── extraction/
    ├── native-text/                       (✅ PRESERVAR)
    ├── ocr/                               (✅ PRESERVAR)
    └── blueprint/
        └── (CRIAR: KnexPdfPageBlueprintBuilder.ts)
```

### Novos Arquivos a Criar
```
src/modules/Knexread/
├── core/
│   └── KnexPdfBlueprintTypes.ts           (NOVO)
├── extraction/
│   ├── blueprint/
│   │   ├── KnexPdfPageBlueprintBuilder.ts
│   │   ├── KnexPdfImageExtractor.ts
│   │   ├── KnexPdfShapeExtractor.ts
│   │   └── index.ts
│   ├── images/
│   │   └── KnexPdfImageElementExtractor.ts
│   └── shapes/
│       └── KnexPdfShapeExtractor.ts
└── rendering/
    └── blueprint/
        ├── KnexPdfBlueprintRenderer.tsx
        ├── KnexPdfBlueprintElementRenderer.tsx
        ├── KnexPdfImageElementRenderer.tsx
        ├── KnexPdfShapeElementRenderer.tsx
        └── index.ts
```

---

## ✅ PRÓXIMOS PASSOS IMEDIATOS

1. **Revisar Tipos Existentes**
   - Ler: `core/KnexPdfTypes.ts` (completar compreensão)
   - Ler: `core/KnexPdfRenderContracts.ts`

2. **Entender Decision Point**
   - Ler: `native-pdf-reader/components/PdfPageView.tsx` linha ~227-400
   - Ver como `modularPagePipelineEnabled` controla pipeline

3. **Mapear Fluxo de Extração**
   - Ler: `extraction/native-text/PdfNativeTextExtractor.ts`
   - Ler: `rendering/text/PdfVisualTextModelBuilder.ts`
   - Entender: como blocos viram spans

4. **Projetar Blueprint Types**
   - Usar template acima como base
   - Criar arquivo: `core/KnexPdfBlueprintTypes.ts`
   - **SEM BREAKING CHANGES** (apenas novo, não altera existente)

---

## 🎯 PRINCÍPIOS DE REFATORAÇÃO

### ✅ DO
- Criar novos tipos que ESTENDEM (não quebram)
- Manter fallback para modo legado
- Adicionar flags de ativação experimental
- Preservar nomes/interfaces existentes
- Testar com feature flags

### ❌ NÃO FAZER
- Renomear tipos/interfaces existentes
- Remover código legado
- Alterar PdfPageView logic
- Quebrar compatibilidade de backends
- Comprometer canvas nativo (ainda necessário para não-texto)

---

**Status**: ✅ Auditoria Completa - Pronto para Fase 1 de Implementação

Todos os 3 documentos detalhados estão em `/memories/session/`
