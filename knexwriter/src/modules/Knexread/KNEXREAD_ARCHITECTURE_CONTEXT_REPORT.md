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

## Worktree Notes

- The workspace is dirty and contains changes not made in this pass.
- Deleted legacy `future-pdfium` and `future-mupdf` files are present in the worktree diff. They were already part of the current workspace state during this pass; do not restore or remove them without a separate decision.
- Existing reports such as `REFACTORING_PHASE1_SUMMARY.md` and `native-pdf-reader/TILE_RENDERER_STATUS.md` are preserved, but this file should be the first context shortcut for the current architecture direction.

## Next Safe Steps

1. Wire the new cache key builder into render/text/cache code paths without changing visual behavior.
2. Validate `single-canvas-html-text` in browser with a real PDF before deleting tile files.
3. Validate the PDFium non-text path in-browser with a real runtime and a real PDF. Confirm `data-knex-pdf-render-source="pdfium"` and `data-knex-pdf-text-suppression-status="applied"` after HTML text is ready.
4. Register an OCR adapter for `PdfOcrPipeline` and feed the detector with image coverage/page analysis.
5. Improve the PDFium text geometry extractor with font metadata when the runtime exposes font names/weights/transforms.
6. Move text selection creation fully into `rendering/text` and emit annotation drafts through callbacks/services.

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
