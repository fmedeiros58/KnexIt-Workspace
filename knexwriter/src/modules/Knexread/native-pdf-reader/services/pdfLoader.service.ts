import { createPdfFingerprint } from "../utils";

type PdfLoadingTask = { promise: Promise<any> };

type PdfPageProxy = {
  getViewport: (params: { scale: number }) => {
    width: number;
    height: number;
    transform: number[];
    scale: number;
    convertToViewportRectangle?: (rect: number[]) => number[];
  };
  getTextContent: (params?: {
    disableCombineTextItems?: boolean;
    normalizeWhitespace?: boolean;
  }) => Promise<{
    items: Array<{
      str?: string;
      transform?: number[];
      width?: number;
      height?: number;
      fontName?: string;
    }>;
    styles?: Record<string, { fontFamily?: string }>;
  }>;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    viewport: { width: number; height: number };
    intent: "display";
    transform?: number[];
  }) => { promise: Promise<void>; cancel?: () => void };
  getAnnotations?: (params?: { intent?: "display" | "print" }) => Promise<
    Array<{
      subtype?: string;
      rect?: number[];
      url?: string;
      unsafeUrl?: string;
      dest?: unknown;
    }>
  >;
};

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  getDestination?: (destination: string) => Promise<unknown[] | null>;
  getPageIndex?: (reference: unknown) => Promise<number>;
  getMetadata?: () => Promise<{
    info?: Record<string, unknown>;
    metadata?: { get: (key: string) => unknown };
  }>;
};

type PdfJsDocumentSource = {
  data: Uint8Array;

  /**
   * Worker.
   */
  disableWorker?: boolean;

  /**
   * Fontes.
   */
  disableFontFace?: boolean;
  useSystemFonts?: boolean;
  fontExtraProperties?: boolean;

  /**
   * Recursos externos necessários para renderizar corretamente PDFs com
   * fontes padrão, CMaps, caracteres especiais, Unicode/CJK etc.
   */
  standardFontDataUrl?: string;
  cMapUrl?: string;
  cMapPacked?: boolean;
  wasmUrl?: string;

  /**
   * Renderização/compatibilidade.
   */
  isEvalSupported?: boolean;
  enableXfa?: boolean;
  stopAtErrors?: boolean;

  /**
   * Streaming/range. Para File local com ArrayBuffer, manter false evita
   * bloquear recursos internos que o PDF.js possa usar.
   */
  disableAutoFetch?: boolean;
  disableStream?: boolean;
  disableRange?: boolean;
};

type PdfJsModule = {
  getDocument: (source: PdfJsDocumentSource | unknown) => PdfLoadingTask;
  GlobalWorkerOptions?: { workerSrc?: string };
  version?: string;
};

export type NativePdfSession = {
  id: string;
  fingerprint: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  pageCount: number;
  pdf: PdfDocumentProxy;
  file: File;
};

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

function getPdfJsFromWindow() {
  if (typeof window === "undefined") return null;

  const candidate = (window as unknown as { pdfjsLib?: unknown }).pdfjsLib;

  if (!candidate || typeof candidate !== "object") return null;

  const runtime = candidate as Partial<PdfJsModule>;

  return typeof runtime.getDocument === "function"
    ? (runtime as PdfJsModule)
    : null;
}

function getPdfJsVersion(module: PdfJsModule) {
  return module.version && module.version.trim().length > 0
    ? module.version.trim()
    : "5.4.624";
}

function isLegacyPdfJsRuntime(module: PdfJsModule) {
  return getPdfJsVersion(module).startsWith("2.");
}

function configurePdfWorker(module: PdfJsModule) {
  if (!module.GlobalWorkerOptions) return;
  if (module.GlobalWorkerOptions.workerSrc) return;

  const version = getPdfJsVersion(module);
  const isLegacyRuntime = isLegacyPdfJsRuntime(module);

  module.GlobalWorkerOptions.workerSrc = isLegacyRuntime
    ? `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`
    : `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
}

function getPdfJsAssetBase(module: PdfJsModule) {
  const version = getPdfJsVersion(module);

  /**
   * Usamos jsDelivr para assets porque ele expõe cmaps, standard_fonts e wasm
   * em estrutura igual ao pacote pdfjs-dist.
   *
   * Mesmo quando o runtime legacy veio do cdnjs, os assets do pacote em
   * jsDelivr costumam ser mais previsíveis para standard_fonts/cmaps.
   */
  return `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/`;
}

function buildPdfDocumentSource(input: {
  module: PdfJsModule;
  data: Uint8Array;
  disableWorker?: boolean;
}): PdfJsDocumentSource {
  const assetBase = getPdfJsAssetBase(input.module);

  return {
    data: input.data,

    disableWorker: input.disableWorker,

    /**
     * Ponto central para qualidade de texto:
     *
     * disableFontFace precisa ficar false para permitir que o PDF.js use
     * @font-face e fontes incorporadas do PDF. Se isso ficar true, alguns PDFs
     * ficam com fonte substituída e aparência ruim.
     */
    disableFontFace: false,

    /**
     * Ajuda quando o PDF usa fontes padrão ou quando alguma fonte não está
     * incorporada corretamente.
     */
    useSystemFonts: true,

    /**
     * Mantém metadados extras de fontes disponíveis para extração/debug.
     */
    fontExtraProperties: true,

    /**
     * Recursos auxiliares do PDF.js.
     * CMaps e standard fonts afetam diretamente textos com caracteres especiais,
     * fontes padrão e alguns PDFs acadêmicos/escaneados com OCR.
     */
    standardFontDataUrl: `${assetBase}standard_fonts/`,
    cMapUrl: `${assetBase}cmaps/`,
    cMapPacked: true,
    wasmUrl: `${assetBase}wasm/`,

    /**
     * Deixar true melhora compatibilidade com alguns programas/fontes do PDF.js.
     */
    isEvalSupported: true,

    /**
     * Não interromper no primeiro erro menor de recurso/fonte.
     */
    stopAtErrors: false,

    /**
     * XFA não é necessário na maioria dos PDFs acadêmicos, mas não prejudica
     * quando o runtime suporta.
     */
    enableXfa: true,

    disableAutoFetch: false,
    disableStream: false,
    disableRange: false,
  };
}

function clonePdfBytes(buffer: ArrayBuffer): Uint8Array {
  /**
   * Importante:
   * PDF.js pode transferir o ArrayBuffer para o worker. Em caso de fallback,
   * reutilizar o mesmo buffer pode falhar se ele tiver sido detached.
   * Por isso, cada tentativa recebe uma cópia própria.
   */
  return new Uint8Array(buffer).slice();
}

function loadScript(url: string) {
  if (typeof document === "undefined") {
    return Promise.resolve(false);
  }

  const existing = Array.from(document.querySelectorAll("script")).find(
    (node) => node.getAttribute("src") === url,
  ) as HTMLScriptElement | undefined;

  if (existing?.dataset.loaded === "true") {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    const script = existing ?? document.createElement("script");

    if (!existing) {
      script.src = url;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }

    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve(true);
      },
      { once: true },
    );

    script.addEventListener(
      "error",
      () => resolve(false),
      { once: true },
    );
  });
}

function pickPdfModule(candidate: unknown): PdfJsModule | null {
  if (!candidate || typeof candidate !== "object") return null;

  const moduleCandidate = candidate as Partial<PdfJsModule>;

  if (typeof moduleCandidate.getDocument === "function") {
    return moduleCandidate as PdfJsModule;
  }

  const defaultCandidate = (candidate as { default?: Partial<PdfJsModule> })
    .default;

  if (defaultCandidate && typeof defaultCandidate.getDocument === "function") {
    return defaultCandidate as PdfJsModule;
  }

  return null;
}

async function getPdfJsModule(): Promise<PdfJsModule> {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = (async () => {
      const errors: string[] = [];

      const candidates = [
        () => import("pdfjs-dist/legacy/build/pdf.mjs"),
        () => import("pdfjs-dist/build/pdf.mjs"),
      ];

      for (const load of candidates) {
        try {
          const loaded = await load();
          const runtime = pickPdfModule(loaded);

          if (runtime) {
            configurePdfWorker(runtime);

            if (typeof window !== "undefined") {
              (window as unknown as { pdfjsLib?: PdfJsModule }).pdfjsLib =
                runtime;
            }

            return runtime;
          }
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : "erro desconhecido",
          );
        }
      }

      const fromWindow = getPdfJsFromWindow();

      if (fromWindow) {
        configurePdfWorker(fromWindow);
        return fromWindow;
      }

      const loadedByCdn = await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js",
      );

      if (loadedByCdn) {
        const runtime = getPdfJsFromWindow();

        if (runtime) {
          configurePdfWorker(runtime);
          return runtime;
        }

        errors.push("CDN carregou, mas window.pdfjsLib não ficou disponível");
      } else {
        errors.push("falha ao carregar script CDN");
      }

      throw new Error(`Falha ao carregar PDF.js: ${errors.join(" | ")}`);
    })().catch((error) => {
      pdfJsModulePromise = null;
      throw error;
    });
  }

  return pdfJsModulePromise;
}

export async function loadNativePdfSession(
  file: File,
): Promise<NativePdfSession> {
  const [pdfjs, fingerprint] = await Promise.all([
    getPdfJsModule(),
    createPdfFingerprint(file),
  ]);

  const buffer = await file.arrayBuffer();

  let pdf: PdfDocumentProxy;

  try {
    pdf = await pdfjs.getDocument(
      buildPdfDocumentSource({
        module: pdfjs,
        data: clonePdfBytes(buffer),
      }),
    ).promise;
  } catch (firstError) {
    try {
      pdf = await pdfjs.getDocument(
        buildPdfDocumentSource({
          module: pdfjs,
          data: clonePdfBytes(buffer),
          disableWorker: true,
        }),
      ).promise;
    } catch (fallbackError) {
      const first =
        firstError instanceof Error ? firstError.message : "erro desconhecido";
      const fallback =
        fallbackError instanceof Error
          ? fallbackError.message
          : "erro desconhecido";

      throw new Error(`Falha ao abrir PDF: ${first}. Fallback: ${fallback}`);
    }
  }

  return {
    id: fingerprint.slice(0, 16),
    fingerprint,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/pdf",
    pageCount: pdf.numPages,
    pdf,
    file,
  };
}
