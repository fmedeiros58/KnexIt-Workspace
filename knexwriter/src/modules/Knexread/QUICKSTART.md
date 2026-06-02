# KnexRead 2.0 - Guia Rápido de Implementação

## Estrutura Criada

```
✅ = Implementado
📋 = Placeholder/Em construção
```

### Core (Tipos e Contratos)
- ✅ `core/KnexPdfTypes.ts` - 480 linhas - Tipos fundamentais
- ✅ `core/KnexPdfRenderContracts.ts` - 290 linhas - Interfaces de renderização  
- ✅ `core/KnexPdfLayerContracts.ts` - 310 linhas - Interfaces de camadas
- ✅ `core/KnexPdfGeometry.ts` - 400+ linhas - Geometria e coordenadas
- ✅ `core/KnexPdfCapabilities.ts` - 320+ linhas - Detecção de capacidades

### Backends
- ✅ `backends/pdfium/PdfiumBackend.ts` - 250 linhas - Adapter para PDFium
- 📋 `backends/pdfjs/` - Placeholder para PDF.js fallback

### Rendering - Canvas
- ✅ `rendering/canvas/BlankCanvasBuilder.ts` - 400+ linhas - Canvas em branco
- ✅ `rendering/canvas/PdfSingleCanvasRenderer.ts` - 350+ linhas - Renderizador único
- 📋 `rendering/canvas/PdfCanvasQualityPolicy.ts` - (próximo: decisão de qualidade)
- 📋 `rendering/canvas/PdfCanvasLifecycle.ts` - (próximo: ciclo de vida)

### Rendering - Outros
- 📋 `rendering/text/` - Em construção
- 📋 `rendering/annotations/` - Em construção
- 📋 `rendering/search/` - Em construção
- 📋 `rendering/composition/` - Em construção
- 📋 `rendering/diagnostics/` - Em construção

### Extraction
- 📋 `extraction/native-text/` - Em construção
- 📋 `extraction/ocr/` - Em construção
- 📋 `extraction/unified-text/` - Em construção

### Outros Módulos
- 📋 `annotations/` - Domain, services, SQL, hooks
- 📋 `interaction/` - Zoom/scroll, keyboard, pointer
- 📋 `cache/` - Cache layer
- 📋 `state/` - State management
- ✅ `config/KnexPdfDefaultConfig.ts` - 300+ linhas - Configuração centralizada

## Importações Recomendadas

### Types (não alteram código existente)
```typescript
import type {
  KnexPdfPageGeometry,
  KnexPdfRenderScale,
  KnexPdfTextBlock,
  KnexPdfAnnotation,
  KnexPdfRenderMode,
  KnexPdfRenderQuality,
  KnexPdfBackendCapabilities,
  KnexPdfRenderedPage,
  KnexPdfViewport,
} from '@/modules/Knexread/core';
```

### Contratos (implementar interfaces)
```typescript
import type {
  IKnexPdfBackend,
  IKnexPdfPageRenderer,
  IKnexPdfTextGeometryExtractor,
  IKnexPdfRenderCache,
  IKnexPdfLayerRenderer,
  IKnexPdfViewportManager,
} from '@/modules/Knexread/core';
```

### Utilidades (usar classes)
```typescript
import {
  KnexPdfRenderScaleBuilder,
  KnexPdfCoordinateConverter,
  KnexPdfPageGeometryCalculator,
  KnexPdfViewportManager,
} from '@/modules/Knexread/core';

import {
  KnexPdfCapabilityDetector,
  KnexPdfCapabilityChecker,
} from '@/modules/Knexread/core';
```

### Canvas (nova funcionalidade)
```typescript
import {
  BlankCanvasBuilder,
  BlankCanvasScaleCalculator,
  PdfSingleCanvasRenderer,
} from '@/modules/Knexread/rendering/canvas';
```

### Config (substituir hardcodes)
```typescript
import {
  KnexPdfConfigManager,
  KNEX_PDF_DEFAULT_RENDER_CONFIG,
  KNEX_PDF_DEFAULT_GEOMETRY,
  KNEX_PDF_FEATURE_FLAGS,
} from '@/modules/Knexread/config';
```

## Como Integrar

### 1. Verificar Capacidades do Backend

```typescript
import { KnexPdfCapabilityDetector } from '@/modules/Knexread/core';

const detection = KnexPdfCapabilityDetector.detectPdfiumCapabilities();
console.log('Backend capabilities:', detection.capabilities);
console.log('Warnings:', detection.warnings);
console.log('Errors:', detection.errors);
```

### 2. Criar Backend Adapter

```typescript
import { PdfiumBackendFactory } from '@/modules/Knexread/backends/pdfium';

const backend = PdfiumBackendFactory.createWithEngine(existingKnexPdfEngine);
```

### 3. Usar Canvas Builder

```typescript
import { BlankCanvasBuilder } from '@/modules/Knexread/rendering/canvas';

const canvas = BlankCanvasBuilder.create({
  widthPt: 595.275,
  heightPt: 841.890,
  zoom: 1.0,
  devicePixelRatio: window.devicePixelRatio,
});

container.appendChild(canvas.canvas);
```

### 4. Usar Canvas Renderer

```typescript
import { PdfSingleCanvasRenderer } from '@/modules/Knexread/rendering/canvas';

const renderer = new PdfSingleCanvasRenderer(backend);

renderer.subscribe({
  onRenderStart: (token) => console.log('Render started', token),
  onRenderProgress: (token, progress) => console.log('Progress:', progress),
  onRenderComplete: (token, result) => console.log('Done', result),
  onRenderError: (token, error) => console.error('Error', error),
});

const result = await renderer.renderPage({
  pageIndex: 0,
  scale: { /* ... */ },
  config: {
    quality: 'extreme',
    includeText: true,
    includeAnnotations: false,
    useCache: true,
    backgroundColor: '#ffffff',
  },
});
```

## Conversão de Coordenadas

```typescript
import { KnexPdfCoordinateConverter } from '@/modules/Knexread/core';

// PDF para CSS
const css = KnexPdfCoordinateConverter.pdfToCss(
  100, // pdfX
  200, // pdfY
  { width: 595.275, height: 841.890 }, // page size
  1.0, // zoom
  0, // rotation (0, 90, 180, 270)
);

// CSS para PDF
const pdf = KnexPdfCoordinateConverter.cssToPdf(
  css.x, css.y,
  { width: 595.275, height: 841.890 },
  1.0,
  0,
);

// Rects
const cssRect = KnexPdfCoordinateConverter.pdfRectToCss(
  { x: 100, y: 200, width: 50, height: 30 },
  { width: 595.275, height: 841.890 },
  1.0,
  0,
);
```

## Feature Flags

```typescript
import { KnexPdfConfigManager } from '@/modules/Knexread/config';

const config = KnexPdfConfigManager.getInstance();

// Ativar novas features (definiir antes de inicializar)
config.setFeatureFlag('ENABLE_SINGLE_CANVAS_RENDERER', true);
config.setFeatureFlag('ENABLE_HTML_TEXT_LAYER', true);
config.setFeatureFlag('ENABLE_ANNOTATIONS', true);

// Verificar status
if (config.getFeatureFlag('ENABLE_SINGLE_CANVAS_RENDERER')) {
  // Use novo renderizador
}

// Obter configuração
const renderConfig = config.getConfig();
const docConfig = config.getConfigForDocumentSize(pageCount);
```

## Validações Importantes

### Geometria
```typescript
import { KnexPdfPageGeometryCalculator } from '@/modules/Knexread/core';

// Validar dimensões
const isValid = KnexPdfPageGeometryCalculator.validateDimensions(
  width,
  height,
  { maxDimension: 10000, minDimension: 1 },
);
```

### Canvas
```typescript
import { BlankCanvasScaleCalculator } from '@/modules/Knexread/rendering/canvas';

// Calcular escala ótima
const scale = BlankCanvasScaleCalculator.calculateOptimalScale({
  pageSizePoints: { width: 595, height: 842 },
  zoom: 1.0,
  maxPixelDimension: 4000,
});

// Validar viabilidade
const viable = BlankCanvasScaleCalculator.isViableScale(scale);
```

## Debugging

```typescript
// Ativar debug global
(globalThis as any).KNEX_PDF_DEBUG_RENDER = true;
(globalThis as any).KNEX_PDF_DEBUG_PAGE_GEOMETRY = true;
(globalThis as any).KNEX_PDF_DEBUG_CACHE = true;

// Ativar no config
const config = KnexPdfConfigManager.getInstance();
config.setFeatureFlag('ENABLE_DEBUG_OVERLAY', true);
config.setFeatureFlag('ENABLE_PERFORMANCE_MONITORING', true);
```

## Próximos Passos

1. **Testar integração** com KnexPdfEngine existente
2. **Implementar text layer** modularizado (Fase 5)
3. **Adicionar testes** unitários para core/
4. **Documentar** casos de uso específicos
5. **Migrar gradualmente** componentes existentes

## Contato e Dúvidas

Referência: `REFACTORING_PHASE1_SUMMARY.md`
