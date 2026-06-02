# Knexread Architecture Context Report

Last updated: 2026-06-01

Read this file before re-auditing the full Knexread tree. It records the current architectural direction, the active file map, the known checkpoints, and what was changed in the latest modularization pass.

## Direction

- PDFium remains the target primary backend.
- PDF.js remains the compatibility/fallback path.
- MuPDF is out of scope and must not be reintroduced.
- Tiles must not be the main architecture. Existing tile code is preserved as legacy, fallback, or experimental surface.
- The target page model is single page canvas plus HTML/CSS text layer.
- Selection belongs to the text module.
- Annotations are Knexread domain data, not canvas/PDF backend data.
- OCR is a future extraction source and must produce text compatible with the unified text model.

## Current Runtime Map

- Main page component: `native-pdf-reader/components/PdfPageView.tsx`
- Reader shell, zoom/scroll orchestration, page virtualization: `native-pdf-reader/components/PdfReaderShell.tsx`
- Current visual tile components: `native-pdf-reader/components/pdf-tiles/*`
- Current text layer component: `native-pdf-reader/components/PdfTextLayer.tsx`
- Current annotation layer component: `native-pdf-reader/components/PdfAnnotationLayer.tsx`
- Current engine contracts and state: `native-pdf-reader/knex-pdf-engine/core/*`
- Current PDF.js renderer path: `native-pdf-reader/knex-pdf-engine/rendering/PdfJsTileRenderer.ts`
- Current tile cache path: `native-pdf-reader/knex-pdf-engine/rendering/PageTileCache.ts`
- Current page bitmap cache path: `native-pdf-reader/knex-pdf-engine/cache/PageBitmapCache.ts`
- New core contracts: `core/*`
- New PDFium adapter shell: `backends/pdfium/PdfiumBackend.ts`
- New single-canvas shell: `rendering/canvas/*`
- New text/selection contracts: `rendering/text/*`
- New annotation domain/contracts: `annotations/*`
- New OCR/unified text contracts: `extraction/*`
- New cache key contract: `cache/PdfCacheKeyBuilder.ts`
- Modular page stage: `rendering/composition/PdfModularPageStage.tsx`
- Modular canvas surface: `rendering/canvas/PdfCanvasLayer.tsx`
- Modular native text extractor: `extraction/native-text/PdfNativeTextExtractor.ts`
- Modular OCR entry point: `extraction/ocr/PdfOcrPipeline.ts`
- Modular HTML text renderer/model: `rendering/text/PdfHtmlTextLayer.tsx`, `rendering/text/PdfVisualTextModelBuilder.ts`, `rendering/text/PdfTextCssFactory.ts`
- Modular PDFium runtime adapter: `backends/pdfium/PdfiumRuntimeAdapter.ts`
- Modular PDFium non-text canvas renderer: `backends/pdfium/PdfiumNonTextRenderer.ts`

## Seven Checkpoints

1. Modular contracts exist, but most are not wired into runtime yet.
2. PDFium is the target backend, but the current live reader still depends heavily on existing native-pdf-reader engine paths and PDF.js-compatible rendering.
3. Tiles are still present and currently functional. They must be preserved, but should move toward fallback/experimental use.
4. `PdfPageView.tsx` still owns too many responsibilities and should be reduced by delegation to composition, canvas, text, annotation, and diagnostics modules.
5. HTML/CSS text rendering now has a modular runtime path: PDFium native extraction when available, PDF.js fallback extraction, OCR fallback decision, visual text model, CSS factory, and HTML renderer. Alignment still needs browser validation with real PDFs.
6. Annotations now have domain/repository/schema contracts, but persistence is not implemented here.
7. OCR/unified-text/cache contracts exist as safe entry points. The modular page stage now calls the OCR pipeline only when the detector says native text is missing or weak. OCR still requires an adapter registration before it can produce text.

## Latest Adjustments

- Added an activatable blueprint route on top of the modular page stage:
  - `rendering/composition/PdfBlueprintStage.tsx`
  - `rendering/blueprint/KnexPdfBlueprintRenderer.tsx`
  - `rendering/blueprint/KnexPdfBlueprintElementRenderer.tsx`
  - `rendering/blueprint/PdfPagePresentationSurface.tsx`
  - `rendering/blueprint/PdfNonTextElementRenderer.tsx`
  - `rendering/blueprint/PdfHtmlTextRenderer.tsx`
- `PdfModularPageStage.tsx` now routes to `PdfBlueprintStage` by default
  whenever the modular page pipeline is active. Use
  `globalThis.KNEX_PDF_DISABLE_BLUEPRINT_MODE = true` or
  `globalThis.KNEX_PDF_FORCE_LEGACY_MODULAR_STAGE = true` only for explicit
  fallback to the older single-canvas HTML stage.
- `PdfPageView.tsx` now mirrors that route in DOM diagnostics with
  `data-knexread-page-render-mode="blueprint"` and
  `data-knexread-page-blueprint-pipeline="true"` when the blueprint flag is on.
  It remounts the modular stage when the blueprint flag changes so the staged
  route and page diagnostics stay in sync.
- `extraction/blueprint/KnexPdfBlueprintBuilder.ts` now builds a runtime page
  blueprint from the live PDF session. It extracts native/OCR text into visual
  text elements and extracts PDF widget annotations as DOM form fields.
- The blueprint stage renders a page as:
  - `PdfPagePresentationSurface` as the DOM surface;
  - canvas structural fallback underneath for non-text content;
  - `PdfNonTextElementRenderer` for extracted image/shape/form-field elements;
  - `PdfHtmlTextRenderer` for real visible HTML text spans.
- Blueprint text now goes through a conservative native/OCR merge policy before
  rendering. Native text remains primary; OCR blocks are added only when text and
  geometry do not overlap likely native duplicates.
- The blueprint canvas asks `PdfCanvasLayer` to suppress canvas text for the
  whole blueprint route. Text presentation is owned by `PdfHtmlTextRenderer`;
  if PDFium non-text rendering is unavailable, the existing canvas layer records
  the fallback reason in DOM diagnostics.
- Image and shape structural extraction are intentionally not claimed as active
  yet. The blueprint builder defaults those flags off; non-text visual content
  remains handled by the non-text canvas surface until a real PDF operations
  extractor is wired.
- Removed active MuPDF references from the Knexread engine/rendering/core scopes that were still visible in comments or backend union types.
- Added cache key contract:
  - `cache/PdfCacheKeyBuilder.ts`
- Added annotation domain/service/schema contracts:
  - `annotations/domain/KnexPdfAnnotationTypes.ts`
  - `annotations/domain/KnexPdfAnnotationModel.ts`
  - `annotations/services/PdfAnnotationRepository.ts`
  - `annotations/sql/annotation.schema.ts`
- Added OCR need detector:
  - `extraction/ocr/PdfOcrNeedDetector.ts`
- Added unified text model builder:
  - `extraction/unified-text/PdfUnifiedTextModelBuilder.ts`
- Added text selection geometry/controller/action contracts:
  - `rendering/text/PdfTextSelectionGeometry.ts`
  - `rendering/text/PdfTextSelectionController.ts`
  - `rendering/text/PdfSelectedTextActions.ts`
- Added layer ordering contract:
  - `rendering/composition/PdfPageLayerConfig.ts`
- Replaced placeholder exports in:
  - `cache/index.ts`
  - `extraction/ocr/index.ts`
  - `rendering/text/index.ts`
  - `rendering/annotations/index.ts`
- Added public module indexes:
  - `annotations/index.ts`
  - `extraction/index.ts`
  - `rendering/index.ts`
- Added gated runtime bridge:
  - `PdfPageView.tsx` can mount `single-canvas-html-text` when `globalThis.KNEX_PDF_USE_MODULAR_PAGE_PIPELINE = true`.
- `PdfModularPageStage.tsx` now owns the new reader stage: canvas surface, native text extraction, OCR decision, OCR pipeline call, visual text model, and HTML text layer.
- `PdfHtmlTextLayer.tsx` no longer wraps the legacy `native-pdf-reader/components/PdfTextLayer.tsx`. It renders the new visual text model directly.
- `PdfCanvasLayer.tsx` no longer calls legacy page/tile render helpers. It renders from `session.pdf.getPage(pageNumber)` directly and exposes runtime diagnostics on the canvas dataset.
- When HTML text blocks are ready, the modular stage asks the canvas to render without text. If a PDF.js operator filter is unavailable, it keeps a blank structural canvas and records `data-knex-pdf-non-text-filter-reason`.
- `PdfNativeTextExtractor.ts` extracts geometric text blocks from the document page and feeds both selection and HTML rendering.
- `PdfOcrPipeline.ts` is wired into the stage. Without a registered OCR adapter it returns `ocr-engine-adapter-not-registered` instead of pretending OCR succeeded.
- Added PDFium runtime adapter in the new module:
  - `backends/pdfium/PdfiumRuntimeAdapter.ts`
  - `backends/pdfium/PdfiumNonTextRenderer.ts`
- `PdfCanvasLayer.tsx` now tries PDFium first. When HTML text is ready, it requests a PDFium non-text canvas. If the runtime is missing or non-text suppression is unavailable, it falls back explicitly to PDF.js non-text filtering or to a blank structural canvas.
- `PdfNativeTextExtractor.ts` now tries PDFium geometric text extraction first and falls back to PDF.js text extraction.
- `PdfHtmlTextLayer.tsx` now marks `data-knexread-html-text-over-canvas="true"` and receives pointer events for browser text selection over the canvas.
- Important: PDFium output still requires a live runtime. Supported runtime paths are a global `KNEX_PDFIUM_RUNTIME` / `__KNEX_PDFIUM_RUNTIME__`, or dynamic module `KNEX_PDFIUM_RUNTIME_MODULE`, defaulting to `@embedpdf/pdfium` plus `/vendor/pdfium/pdfium.wasm`.

## Feature Flags

Primary config file: `config/KnexPdfDefaultConfig.ts`

Important flags currently present:

- `ENABLE_SINGLE_CANVAS_RENDERER`
- `ENABLE_MODULAR_PAGE_PIPELINE`
- `DISABLE_TILES_MANDATORY`
- `ENABLE_HTML_TEXT_LAYER`
- `FORCE_VISUAL_TEXT_LAYER`
- `ENABLE_TEXT_SELECTION`
- `ENABLE_ANNOTATIONS`
- `ENABLE_ANNOTATION_PERSISTENCE`
- `ENABLE_OCR_PIPELINE`
- `AUTO_DETECT_SCANNED_PAGES`
- `ENABLE_DEBUG_OVERLAY`

These flags define the migration surface. Do not flip behavior globally without checking current runtime path in `PdfPageView.tsx` and `PdfReaderShell.tsx`.

Runtime activation for the new bridge:

```js
globalThis.KNEX_PDF_USE_MODULAR_PAGE_PIPELINE = true;
```

Optional hard override alias:

```js
globalThis.KNEX_PDF_FORCE_SINGLE_CANVAS_PAGE = true;
```

The legacy tiled path stays available when both globals are false.

The blueprint stage is now the default modular stage. To force it on for a
legacy document or debugging session, enable the modular pipeline:

```js
globalThis.KNEX_PDF_USE_MODULAR_PAGE_PIPELINE = true;
```

To temporarily fall back to the older modular single-canvas route:

```js
globalThis.KNEX_PDF_DISABLE_BLUEPRINT_MODE = true;
```

Expected DOM markers after activation:

```js
document.querySelector('[data-knexread-blueprint-stage="true"]')
document.querySelector('[data-knexread-blueprint-renderer="true"]')
document.querySelector('[data-knexread-blueprint-element-count]')
document.querySelector('[data-knexread-blueprint-text-count]')
document.querySelector('[data-knexread-page-render-mode="blueprint"]')
document.querySelector('[data-knexread-presentation-surface="blueprint"]')
document.querySelector('[data-knexread-presentation-html-text-surface="true"]')
document.querySelector('[data-knexread-blueprint-html-text-renderer="true"]')
```

PDFium runtime activation options:

```js
globalThis.KNEX_PDFIUM_RUNTIME = myKnexPdfiumRuntimeAdapter;
```

or:

```js
globalThis.KNEX_PDFIUM_RUNTIME_MODULE = "@embedpdf/pdfium";
globalThis.KNEX_PDFIUM_WASM_URL = "/vendor/pdfium/pdfium.wasm";
```

To temporarily disable PDFium non-text suppression:

```js
globalThis.KNEX_PDFIUM_DISABLE_NON_TEXT_RENDER = true;
```

## Validation Snapshot

Commands run during this pass:

- `npx tsc --noEmit --pretty false`
- `npm run verify:knexread-tiles`
- `git diff --check -- knexwriter/src/modules/Knexread`

Current status after this pass:

- TypeScript compile: passed.
- Tile renderer guard: passed.
- Diff whitespace check: passed; Git only reported line-ending normalization warnings.
- MuPDF reference check in engine/core/backends/rendering scopes: no matches.

Additional 2026-06-01 validation after wiring the modular bridge:

- TypeScript compile: passed.
- Tile renderer guard: passed.

Additional 2026-06-01 validation after PDFium non-text adapter wiring:

- TypeScript compile: passed.
- Tile renderer guard: passed.
- New-file trailing whitespace scan: passed.
- Rendering module legacy helper scan: no matches.

Additional 2026-06-01 validation after blueprint stage wiring:

- TypeScript compile: passed.
- Blueprint placeholder/stub scan: no TODO/FIXME/stub/not-implemented markers in
  the blueprint route. Matches for `placeholder` are real HTML form field
  attributes only.
- Local dev server check: `http://localhost:3000` responded with HTTP 200.
- Package lint: previously blocked before ESLint by protected extension point
  checks for already-missing legacy/future files:
  - `native-pdf-reader/knex-pdf-engine/backends/future-mupdf/MuPdfBackend.placeholder.ts`
  - `native-pdf-reader/knex-pdf-engine/backends/future-mupdf/README.md`
  - `native-pdf-reader/knex-pdf-engine/backends/future-pdfium/PdfiumBackend.placeholder.ts`
  - `native-pdf-reader/knex-pdf-engine/backends/future-pdfium/README.md`
  - `native-pdf-reader/knex-pdf-engine/translation/TranslationReconstructionEngine.placeholder.ts`

Additional 2026-06-01 validation after presentation surface split:

- TypeScript compile: passed.
- Diff whitespace check for `src/modules/Knexread`: passed; Git only reported
  line-ending normalization warnings.
- `knex-pdf-engine` migration matrix created:
  - `KNEX_PDF_ENGINE_BLUEPRINT_MIGRATION_AUDIT.md`
- Current matrix summary:
  - Essencial para leitura/extracao: 48 arquivo(s)
  - Essencial para novo blueprint: 4 arquivo(s)
  - Fallback temporario: 8 arquivo(s)
  - Legado de apresentacao raster/canvas: 19 arquivo(s)

Additional 2026-06-01 adjustment after making blueprint the default stage:

- Removed `scripts/check-knexpdf-extension-points.mjs` from the lint chain and
  deleted the script. It required legacy placeholder/guard files that
  conflict with the controlled cleanup direction.
- `PdfPageView.tsx` now reports `data-knexread-page-render-mode="blueprint"`
  by default for the modular route.
- `PdfBlueprintStage.tsx` now keeps canvas text disabled for the blueprint
  route; visible text must come from the HTML blueprint renderer.
- `scripts/check-knexpdf-render-pipeline.mjs` now protects the blueprint/HTML
  route instead of the old raster presentation files.
- Validation after this adjustment:
  - TypeScript compile: passed.
  - Diff whitespace check: passed; Git only reported line-ending normalization warnings.
  - Package lint: passed with existing warnings, no errors. The blueprint render
    pipeline guard reported OK.

Additional 2026-06-01 adjustment after browser text-style audit:

- Confirmed by code path that visible blueprint text is rendered through:
  `PdfPagePresentationSurface -> PdfHtmlTextRenderer -> KnexPdfBlueprintElementRenderer -> createPdfTextRunStyle`.
- Added PDF font/style normalization:
  - `rendering/text/PdfTextFontResolver.ts`
  - `rendering/text/PdfTextStyleNormalizer.ts`
  - `rendering/text/PdfTextLayerDiagnostics.ts`
- `PdfVisualTextModelBuilder.ts` now emits explicit text runs with
  `fontName`, `baseline`, `wordSpacing`, `textSource`, `geometrySource`,
  `styleSource`, `missingFontFamily`, and `usedUiFontFamily`.
- `PdfTextCssFactory.ts` now resolves PDF font names/families before styling,
  neutralizes inherited UI typography, and keeps HTML geometry in CSS
  coordinates.
- `PdfHtmlTextRenderer.tsx` and `PdfHtmlTextLayer.tsx` now reset inherited
  UI typography on their root nodes and expose font/style diagnostics in DOM.
- Controlled runtime diagnostics are available with:

```js
globalThis.KNEX_PDF_DEBUG_BLUEPRINT_TEXT = true;
```

Expected DOM markers for this pass:

```js
document.querySelector('[data-knexread-blueprint-html-generic-ui-font-runs]')
document.querySelectorAll('[data-knexread-blueprint-element="text"][data-knexread-blueprint-font-family]')
document.querySelectorAll('[data-knexread-blueprint-used-ui-font-family="true"]')
```

- Validation after this adjustment:
  - TypeScript compile: passed.
  - Package lint: passed with existing warnings, no errors. The blueprint render
    pipeline guard reported OK.

## Worktree Notes

- The workspace is dirty and contains changes not made in this pass.
- Deleted legacy `future-pdfium` and `future-mupdf` files are present in the worktree diff. They were already part of the current workspace state during this pass; do not restore or remove them without a separate decision.
- Existing reports such as `REFACTORING_PHASE1_SUMMARY.md` and `native-pdf-reader/TILE_RENDERER_STATUS.md` are preserved, but this file should be the first context shortcut for the current architecture direction.

## Next Safe Steps

1. Validate the blueprint stage in browser with a real PDF before deleting
   fallback/legacy files.
2. Wire the new cache key builder into render/text/cache code paths without changing visual behavior.
3. Validate `blueprint` in browser with a real PDF before deleting tile files.
4. Validate the PDFium non-text path in-browser with a real runtime and a real PDF. Confirm `data-knex-pdf-render-source="pdfium"` and `data-knex-pdf-text-suppression-status="applied"`.
5. Register an OCR adapter for `PdfOcrPipeline` and feed the detector with image coverage/page analysis.
6. Implement real PDF operation extraction for images/shapes if the blueprint is expected to replace the non-text canvas completely.
7. Improve the PDFium text geometry extractor with font metadata when the runtime exposes font names/weights/transforms.
8. Move text selection creation fully into `rendering/text` and emit annotation drafts through callbacks/services.

## Cleanup Policy

Do not delete legacy tile files until the modular bridge is validated with:

- PDF opens successfully.
- `data-knexread-page-render-mode="single-canvas-html-text"` is visible.
- `data-knex-pdf-render-text="false"` appears after text blocks are available.
- Text remains selectable/copyable.
- Visual text layer aligns with the canvas.
- Fallback to tiled-canvas still works when the modular flag is false.

Candidate cleanup after those checks:

- Move `components/pdf-tiles/*` and `knex-pdf-engine/tiles/*` behind an explicit legacy/experimental namespace.
- Remove stale tile-only status wording after the new path becomes default.
- Remove old backup/deprecated files already marked deleted in the worktree only after confirming they are not referenced.
