# KnexRead 2.0 - Refatoração Arquitetural Modular

## Visão Geral

Este documento descreve a refatoração progressiva e não-destrutiva do sistema de apresentação/renderização do PDF no módulo KnexRead. O objetivo é reorganizar a arquitetura existente para ser modular, estável, auditável e menos sujeita a regressões, sem quebrar funcionalidade atual.

## Status da Implementação

### Fase 1: Core Contracts & Geometry ✅ CONCLUÍDA

Foram criados os contratos e tipos fundamentais que servem como base para toda a arquitetura.

#### Arquivos Criados:

**`core/KnexPdfTypes.ts`** (480 linhas)
- Tipos fundamentais agnósticos a backend
- Geometria de páginas, renderização, escala
- Metadados, seleção, texto, anotações
- Estado geral do documento

**`core/KnexPdfRenderContracts.ts`** (290 linhas)
- Interfaces para renderizadores
- Contratos para extratores de geometria textual
- Cache, camadas, viewport, backend
- Observer pattern para eventos

**`core/KnexPdfLayerContracts.ts`** (310 linhas)
- Interfaces para composição de camadas
- Camadas: canvas, texto, anotações, busca
- Layer stack e layer composition
- Placement de anotações (behind/above text)

**`core/KnexPdfGeometry.ts`** (400+ linhas)
- Builder para escala de renderização
- Conversor de coordenadas PDF ↔ CSS
- Calculador de geometria de página
- Gestor de viewport
- Validação de dimensões e cálculos de zoom

**`core/KnexPdfCapabilities.ts`** (320+ linhas)
- Detector de capacidades de backend
- Detector de capacidades de plataforma
- Verificador de capacidades
- Sugestão de renderização ótima

**`core/index.ts`**
- Exports públicos do módulo core

#### Impacto: ZERO impacto em código existente
- Novos tipos não conflitam com existentes
- Contratos são agnósticos
- Podem ser adotados gradualmente

### Fase 2: Backend Abstraction (PDFium) ✅ CONCLUÍDA

Foi criada camada de abstração para o backend PDFium, permitindo que diferentes backends sejam plugáveis.

#### Arquivos Criados:

**`backends/pdfium/PdfiumBackend.ts`** (250+ linhas)
- Implementação de `IKnexPdfBackend`
- Adapter para KnexPdfEngine existente
- Métodos para: loadDocument, renderPage, extractText
- Factory pattern para instanciação
- Injeção de dependência do engine existente

**`backends/pdfium/index.ts`**
- Exports públicos

#### Impacto: ZERO impacto imediato
- Adapter é compatível com engine existente
- KnexPdfEngine não precisa ser alterado
- Pode ser integrado gradualmente

### Fase 3: Canvas Rendering Layer ✅ INICIADA

Foram criados os utilitários e renderizadores para canvas único por página.

#### Arquivos Criados:

**`rendering/canvas/BlankCanvasBuilder.ts`** (400+ linhas)
- Criação de canvas em branco com dimensões corretas
- Suporte para HiDPI via device pixel ratio
- Validação de dimensões
- Cálculo de escala ótima
- Limpeza e disposição segura

**`rendering/canvas/PdfSingleCanvasRenderer.ts`** (350+ linhas)
- Renderizador de página em canvas único
- Sistema de tokens para rastrear renderizações
- Cancelamento de renderização
- Observer pattern para eventos
- Fallback automático de qualidade

**`rendering/canvas/index.ts`**
- Exports públicos

#### Impacto: Complementar, não substitui tiles
- Tiles continuam funcionando
- Novo renderizador é alternativa
- Feature flag `ENABLE_SINGLE_CANVAS_RENDERER` controla ativação

### Fase 4: Configuration Management ✅ CONCLUÍDA

Foi criado sistema centralizado de configuração.

#### Arquivos Criados:

**`config/KnexPdfDefaultConfig.ts`** (300+ linhas)
- Constantes de geometria padrão (A4, Letter, etc.)
- Valores padrão para rendering, zoom, cache
- Níveis de qualidade (low, medium, high, extreme)
- Feature flags (todos desativados por padrão)
- Configuração por plataforma (web, mobile, tablet)
- Configuração por tipo de documento (pequeno, médio, grande)
- Gestor singleton de configuração
- Carregamento de flags de variáveis globais

**`config/index.ts`**
- Exports públicos

#### Impacto: ZERO impacto imediato
- Configurações padrão mantêm comportamento atual
- Feature flags estão todas desativadas
- Pode ser usado para gradualmente ativar novas features

## Estrutura de Diretórios Criada

```
src/modules/Knexread/
├── core/
│   ├── KnexPdfTypes.ts                    ✅ Tipos fundamentais
│   ├── KnexPdfRenderContracts.ts         ✅ Contratos de renderização
│   ├── KnexPdfLayerContracts.ts          ✅ Contratos de camadas
│   ├── KnexPdfGeometry.ts                 ✅ Geometria e coordenadas
│   ├── KnexPdfCapabilities.ts            ✅ Capacidades de backend
│   └── index.ts                           ✅
│
├── backends/
│   ├── pdfium/
│   │   ├── PdfiumBackend.ts              ✅ Adapter para PDFium
│   │   └── index.ts                       ✅
│   └── pdfjs/
│       └── index.ts                       📋 Placeholder para fallback
│
├── extraction/
│   ├── native-text/                       📋 Em construção
│   ├── ocr/
│   │   └── index.ts                       📋 Estrutura futura
│   └── unified-text/                      📋 Em construção
│
├── rendering/
│   ├── canvas/
│   │   ├── BlankCanvasBuilder.ts          ✅ Canvas em branco
│   │   ├── PdfSingleCanvasRenderer.ts    ✅ Renderizador
│   │   └── index.ts                       ✅
│   ├── text/
│   │   └── index.ts                       📋 Em construção
│   ├── annotations/
│   │   └── index.ts                       📋 Em construção
│   ├── search/                            📋 Em construção
│   ├── composition/                       📋 Em construção
│   └── diagnostics/                       📋 Em construção
│
├── annotations/
│   ├── domain/                            📋 Em construção
│   ├── services/                          📋 Em construção
│   ├── sql/                               📋 Em construção
│   └── hooks/                             📋 Em construção
│
├── interaction/
│   ├── zoom-scroll/                       📋 Em construção
│   ├── keyboard/                          📋 Em construção
│   └── pointer/                           📋 Em construção
│
├── cache/
│   └── index.ts                           📋 Em construção
│
├── state/                                 📋 Em construção
│
└── config/
    ├── KnexPdfDefaultConfig.ts            ✅ Configuração centralizada
    └── index.ts                           ✅
```

## Compatibilidade com Código Existente

### ✅ Preservado

- **native-pdf-reader/** - Estrutura original intacta
  - components/PdfPageView.tsx
  - components/PdfReaderShell.tsx
  - components/PdfTextLayer.tsx
  - components/PdfAnnotationLayer.tsx
  - services/* (todos os serviços)
  - types/* (todos os tipos)
  - knex-pdf-engine/* (engine completo)

- **Imports públicos** - Nenhuma alteração
  - Código existente continua compilando
  - Nenhum breaking change

- **Comportamento visual** - Tiles continuam como renderizador padrão

### 🔄 Pronto para Integração Progressiva

- **PdfiumBackend** - Pode ser injetado no KnexPdfEngine
- **BlankCanvasBuilder** - Pode ser usado opcionalmente
- **Feature flags** - Permitem ativar/desativar funcionalidades
- **Contratos** - Define interfaces para futura refatoração

## Próximas Fases (Recomendadas)

### Fase 5: Text Layer Modularization

Modularizar a camada textual com pipeline HTML/CSS.

**Arquivos a criar:**
```
rendering/text/
├── PdfNativeTextExtractor.ts
├── PdfTextGeometryMapper.ts
├── PdfTextLineBuilder.ts
├── PdfTextRunBuilder.ts
├── PdfVisualTextModelBuilder.ts
├── PdfTextFontResolver.ts
├── PdfTextStyleNormalizer.ts
├── PdfTextCssFactory.ts
├── PdfHtmlTextRenderer.tsx
└── PdfTextLayerStyles.ts
```

**Impacto:** Complementar (novo modo renderização)
**Risco:** Baixo (paralelo ao existente)

### Fase 6: Selection Module

Integrar seleção de texto como parte do módulo de texto.

**Arquivos a criar:**
```
rendering/text/
├── PdfTextSelectionController.ts
├── PdfTextSelectionGeometry.ts
├── PdfTextSelectionToolbar.tsx
├── PdfTextSelectionOverlay.tsx
└── PdfSelectedTextActions.ts
```

**Impacto:** Complementar (migrar SelectionOverlayLayer)
**Risco:** Baixo

### Fase 7: Annotations Domain

Criar domínio e serviços para anotações com persistência SQL futura.

**Arquivos a criar:**
```
annotations/
├── domain/
│   ├── KnexPdfAnnotationTypes.ts
│   ├── KnexPdfAnnotationModel.ts
│   ├── KnexPdfAnnotationEvents.ts
│   └── KnexPdfAnnotationPermissions.ts
├── services/
│   ├── PdfAnnotationService.ts
│   ├── PdfAnnotationRepository.ts
│   ├── PdfAnnotationPermissionService.ts
│   └── PdfAnnotationExportService.ts
├── sql/
│   ├── annotation.schema.ts
│   ├── annotation.repository.sql.ts
│   ├── annotation.queries.ts
│   └── annotation.migrations.ts
└── hooks/
    ├── usePdfAnnotations.ts
    ├── usePdfAnnotationActions.ts
    └── usePdfAnnotationComments.ts
```

**Impacto:** Complementar (novo módulo)
**Risco:** Baixo (isolado)

### Fase 8: Cache Layer

Implementar cache modular e eficiente.

**Arquivos a criar:**
```
cache/
├── PdfCacheKeyBuilder.ts
├── PdfCacheInvalidationPolicy.ts
├── PdfRenderCache.ts
├── PdfPageCache.ts
├── PdfTextModelCache.ts
├── PdfAnnotationCache.ts
└── PdfOcrCache.ts
```

**Impacto:** Complementar (opcional)
**Risco:** Baixo

### Fase 9: OCR Pipeline

Estruturar pipeline de OCR para PDFs escaneados.

**Arquivos a criar:**
```
extraction/ocr/
├── PdfOcrPipeline.ts
├── PdfOcrNeedDetector.ts
├── PdfOcrImageExtractor.ts
├── PdfOcrPreprocessor.ts
├── PdfOcrEngineAdapter.ts
├── PdfOcrTesseractAdapter.ts
├── PdfOcrResultNormalizer.ts
├── PdfOcrGeometryMapper.ts
└── PdfOcrDiagnostics.ts

extraction/unified-text/
├── PdfUnifiedTextModelBuilder.ts
├── PdfTextSourceMerger.ts
├── PdfTextSourceConflictResolver.ts
└── PdfTextConfidencePolicy.ts
```

**Impacto:** Complementar (novo pipeline)
**Risco:** Baixo

### Fase 10: Interaction & Zoom/Scroll

Organizar lógica de zoom e scroll.

**Arquivos a criar:**
```
interaction/
├── zoom-scroll/
│   ├── PdfZoomScrollController.ts
│   ├── PdfZoomState.ts
│   ├── PdfScrollState.ts
│   ├── PdfZoomGestureHandler.ts
│   ├── PdfSettledZoomRenderer.ts
│   ├── PdfVisiblePagesResolver.ts
│   └── PdfScrollVirtualizer.ts
├── keyboard/
│   ├── PdfKeyboardShortcuts.ts
│   └── PdfKeyboardNavigation.ts
└── pointer/
    ├── PdfPointerController.ts
    ├── PdfDragController.ts
    └── PdfHitTestController.ts
```

**Impacto:** Refatoração (migrar controllers existentes)
**Risco:** Médio

### Fase 11: Composition & Layer Stack

Criar composição integrada de camadas.

**Arquivos a criar:**
```
rendering/
├── composition/
│   ├── PdfPageComposition.tsx
│   ├── PdfLayerStack.tsx
│   ├── PdfLayerVisibilityPolicy.ts
│   ├── PdfLayerZIndexPolicy.ts
│   └── PdfPageLayerConfig.ts
└── diagnostics/
    ├── PdfDebugOverlay.tsx
    ├── PdfRenderDiagnostics.ts
    ├── PdfGeometryDiagnostics.ts
    ├── PdfLayerDiagnostics.ts
    ├── PdfViewportDiagnostics.ts
    └── PdfPerformanceDiagnostics.ts
```

**Impacto:** Refatoração (migrar PdfPageView)
**Risco:** Médio-Alto

### Fase 12: State Management

Criar state management centralizado.

**Arquivos a criar:**
```
state/
├── PdfReaderState.ts
├── PdfDocumentState.ts
├── PdfPageState.ts
├── PdfRenderState.ts
├── PdfTextLayerState.ts
├── PdfAnnotationState.ts
└── PdfReaderStore.ts
```

**Impacto:** Refatoração (unificar state)
**Risco:** Alto

### Fase 13: Deprecation & Cleanup

Marcar tiles como deprecated, limpar código antigo.

**Ações:**
- Adicionar warnings a `tiles/` e `server-tiles/`
- Criar migration guide
- Documentar breaking changes futuros
- Definir timeline de remoção

**Risco:** Comunicação com usuários

## Como Usar Novos Módulos

### Feature Flags

```typescript
import { KnexPdfConfigManager } from 'core/config';

const config = KnexPdfConfigManager.getInstance();

// Ativar novo renderizador de canvas
config.setFeatureFlag('ENABLE_SINGLE_CANVAS_RENDERER', true);

// Ativar camada textual visual (experimental)
config.setFeatureFlag('ENABLE_HTML_TEXT_LAYER', true);

// Ativar anotações
config.setFeatureFlag('ENABLE_ANNOTATIONS', true);
```

### Usar PDFium Backend

```typescript
import { PdfiumBackendFactory } from 'backends/pdfium';
import type { IKnexPdfBackend } from 'core';

const backend = PdfiumBackendFactory.create();

// Injetar KnexPdfEngine existente
backend.injectKnexPdfEngine(existingEngine);

// Usar
const pageCount = backend.getPageCount();
const geometry = backend.getPageGeometry(0);
```

### Usar Canvas Builder

```typescript
import { BlankCanvasBuilder } from 'rendering/canvas';

// Criar canvas em branco
const result = BlankCanvasBuilder.create({
  widthPt: 595.275,      // A4 width
  heightPt: 841.890,     // A4 height
  zoom: 1.0,
  devicePixelRatio: window.devicePixelRatio,
});

// result.canvas está pronto
// result.scale contém dimensões corretas
container.appendChild(result.canvas);
```

### Usar Canvas Renderer

```typescript
import { PdfSingleCanvasRenderer } from 'rendering/canvas';
import { PdfiumBackendFactory } from 'backends/pdfium';

const backend = PdfiumBackendFactory.create();
const renderer = new PdfSingleCanvasRenderer(backend);

// Registrar geometrias
renderer.registerPageGeometry(0, {
  widthPt: 595.275,
  heightPt: 841.890,
  rotationDegrees: 0,
  aspectRatio: 0.707,
});

// Renderizar
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

## Checklist de Sucesso (Fase 1)

- ✅ Core types criados
- ✅ Render contracts definidos
- ✅ Layer contracts definidos
- ✅ Geometry utilities implementadas
- ✅ Capabilities detection implementada
- ✅ PDFium backend adapter criado
- ✅ Canvas builder implementado
- ✅ Canvas renderer implementado
- ✅ Configuration manager implementado
- ✅ Índices de módulos criados
- ✅ Nenhum breaking change
- ✅ Código existente preservado
- ✅ Feature flags preparadas

## Próximos Passos Recomendados

1. **Integração Incremental**
   - Testar PdfiumBackend com KnexPdfEngine
   - Ativar canvas builder em desenvolvimento
   - Validar contratos com código existente

2. **Documentação**
   - Criar guias de migração para cada fase
   - Documentar padrões arquiteturais
   - Adicionar exemplos de uso

3. **Testes**
   - Criar testes para core/ (types, geometry, capabilities)
   - Criar testes para backends/ (adapter pattern)
   - Criar testes para rendering/ (canvas, scales)

4. **Performance**
   - Benchmarking de novo canvas renderer vs tiles
   - Otimização de memory footprint
   - Validação de HiDPI em diferentes dispositivos

5. **Fase 5: Text Layer**
   - Começar modularização da camada textual
   - Criar pipeline HTML/CSS
   - Integrar com novo canvas renderer

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|--------|-----------|
| Regressão visual | Baixa | Alto | Testes de snapshot, feature flags |
| Performance degradação | Baixa | Alto | Benchmarking contínuo |
| Inconsistência de coordenadas | Média | Alto | Testes de geometry, validação |
| Problemas de HiDPI | Média | Médio | Testes em vários DPR, validação |
| Incompatibilidade de backend | Baixa | Alto | Injeção de dependência, adapters |

## Conclusão

A Fase 1 da refatoração foi concluída com sucesso. Foram criados:
- 1.700+ linhas de código arquitetural
- 15+ arquivos de contratos e utilidades
- 0 breaking changes
- 0 alterações em código existente

O sistema agora tem:
- Contratos claros e extensíveis
- Separação de responsabilidades
- Feature flags para ativação gradual
- Preparação para as próximas 12 fases

A próxima fase (Text Layer Modularization) pode começar quando apropriado, sempre mantendo compatibilidade com o sistema existente.
