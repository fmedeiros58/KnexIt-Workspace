import type { KnexPdfCanvasRenderResult } from "../../core/engineTypes";
import type { KnexPdfRenderPhase } from "../../rendering/RenderQualityController";
import type {
  PdfBackendRenderPageInput,
  PdfBackendRenderTileInput,
} from "../PdfRenderBackend";
import { PdfiumRuntimeLoader } from "./PdfiumRuntimeLoader";

type PdfiumRenderTaskMetadata = {
  priority?: number;
  renderPriority?: number;
  phase?: KnexPdfRenderPhase;
  renderPhase?: KnexPdfRenderPhase;
  signal?: AbortSignal;
};

type PdfiumRenderQueueEntry = {
  id: number;
  priority: number;
  signal?: AbortSignal;
  resolve: (release: () => void) => void;
  reject: (error: unknown) => void;
  cleanup: () => void;
};

type PdfiumRenderInput = PdfBackendRenderPageInput | PdfBackendRenderTileInput;

const PDFIUM_MAX_CONCURRENT_RENDERS = 1;

/**
 * Render final da página ativa deve ser rápido.
 * Warmup/preload pode esperar um pouco para não travar zoom/scroll.
 */
const PDFIUM_ACTIVE_RENDER_PRIORITY = 90;
const PDFIUM_IDLE_RENDER_TIMEOUT_MS = 700;

let pdfiumQueueSequence = 0;

function createAbortError(): DOMException {
  return new DOMException("PDFium render aborted.", "AbortError");
}

function isAbortSignalAborted(signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted);
}

function getInputMetadata(
  input: PdfiumRenderInput,
): PdfiumRenderTaskMetadata {
  return input as PdfiumRenderInput & PdfiumRenderTaskMetadata;
}

function getRenderPriority(input: PdfiumRenderInput): number {
  const metadata = getInputMetadata(input);
  const priority = metadata.priority ?? metadata.renderPriority ?? 0;

  return Number.isFinite(priority) ? priority : 0;
}

function getRenderPhase(
  input: PdfiumRenderInput,
): KnexPdfRenderPhase | undefined {
  const metadata = getInputMetadata(input);

  return metadata.phase ?? metadata.renderPhase;
}

function getRenderSignal(input: PdfiumRenderInput): AbortSignal | undefined {
  return getInputMetadata(input).signal;
}

function waitForNextFrame(signal?: AbortSignal): Promise<void> {
  if (isAbortSignalAborted(signal)) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let frameId = 0;

    const cleanup = () => {
      if (frameId && typeof globalThis.cancelAnimationFrame === "function") {
        globalThis.cancelAnimationFrame(frameId);
      }

      signal?.removeEventListener("abort", handleAbort);
    };

    const handleAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    signal?.addEventListener("abort", handleAbort, { once: true });

    if (typeof globalThis.requestAnimationFrame === "function") {
      frameId = globalThis.requestAnimationFrame(() => {
        cleanup();
        resolve();
      });
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, 0);

    frameId = timeoutId as unknown as number;
  });
}

function waitForIdle(input: {
  priority: number;
  phase?: KnexPdfRenderPhase;
  signal?: AbortSignal;
}): Promise<void> {
  if (isAbortSignalAborted(input.signal)) {
    return Promise.reject(createAbortError());
  }

  /**
   * Página ativa/visível não deve esperar idle.
   * Warmup/preload espera para não competir com interação.
   */
  const shouldWaitForIdle =
    input.priority < PDFIUM_ACTIVE_RENDER_PRIORITY ||
    input.phase === "warmup-preview" ||
    input.phase === "interactive-preview";

  if (!shouldWaitForIdle) {
    return waitForNextFrame(input.signal);
  }

  return new Promise((resolve, reject) => {
    const runtimeGlobal = globalThis as typeof globalThis & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout?: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let idleId = 0;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

    const cleanup = () => {
      if (idleId && typeof runtimeGlobal.cancelIdleCallback === "function") {
        runtimeGlobal.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }

      input.signal?.removeEventListener("abort", handleAbort);
    };

    const handleAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    input.signal?.addEventListener("abort", handleAbort, { once: true });

    if (typeof runtimeGlobal.requestIdleCallback === "function") {
      idleId = runtimeGlobal.requestIdleCallback(
        () => {
          cleanup();
          resolve();
        },
        { timeout: PDFIUM_IDLE_RENDER_TIMEOUT_MS },
      );
      return;
    }

    timeoutId = globalThis.setTimeout(() => {
      cleanup();
      resolve();
    }, 16);
  });
}

class PdfiumRenderSemaphore {
  private activeCount = 0;
  private readonly queue: PdfiumRenderQueueEntry[] = [];

  async acquire(input: {
    priority: number;
    signal?: AbortSignal;
  }): Promise<() => void> {
    if (isAbortSignalAborted(input.signal)) {
      throw createAbortError();
    }

    if (this.activeCount < PDFIUM_MAX_CONCURRENT_RENDERS) {
      this.activeCount += 1;
      return this.createRelease();
    }

    return new Promise((resolve, reject) => {
      const id = pdfiumQueueSequence;
      pdfiumQueueSequence += 1;

      const entry: PdfiumRenderQueueEntry = {
        id,
        priority: input.priority,
        signal: input.signal,
        resolve,
        reject,
        cleanup: () => undefined,
      };

      const handleAbort = () => {
        const index = this.queue.findIndex((item) => item.id === id);
        if (index >= 0) {
          this.queue.splice(index, 1);
        }

        entry.cleanup();
        reject(createAbortError());
      };

      entry.cleanup = () => {
        input.signal?.removeEventListener("abort", handleAbort);
      };

      input.signal?.addEventListener("abort", handleAbort, { once: true });

      this.queue.push(entry);
      this.queue.sort(
        (a, b) => b.priority - a.priority || a.id - b.id,
      );
    });
  }

  private createRelease(): () => void {
    let released = false;

    return () => {
      if (released) return;
      released = true;

      this.activeCount = Math.max(0, this.activeCount - 1);
      this.dispatchNext();
    };
  }

  private dispatchNext() {
    while (
      this.activeCount < PDFIUM_MAX_CONCURRENT_RENDERS &&
      this.queue.length > 0
    ) {
      const next = this.queue.shift();
      if (!next) return;

      if (isAbortSignalAborted(next.signal)) {
        next.cleanup();
        next.reject(createAbortError());
        continue;
      }

      this.activeCount += 1;
      next.cleanup();
      next.resolve(this.createRelease());
      return;
    }
  }

  snapshot() {
    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      queued: this.queue.map((item) => ({
        id: item.id,
        priority: item.priority,
        aborted: Boolean(item.signal?.aborted),
      })),
    };
  }
}

const pdfiumRenderSemaphore = new PdfiumRenderSemaphore();

export class PdfiumPageRenderer {
  constructor(private readonly runtimeLoader: PdfiumRuntimeLoader) {}

  async render(
    input: PdfBackendRenderPageInput,
  ): Promise<KnexPdfCanvasRenderResult> {
    const priority = getRenderPriority(input);
    const phase = getRenderPhase(input);
    const signal = getRenderSignal(input);

    if (isAbortSignalAborted(signal)) {
      throw createAbortError();
    }

    /**
     * Dá uma chance para o navegador pintar o frame atual antes de iniciar
     * render PDFium pesado. Para warmup/preload, espera idle.
     */
    await waitForIdle({
      priority,
      phase,
      signal,
    });

    const release = await pdfiumRenderSemaphore.acquire({
      priority,
      signal,
    });

    try {
      if (isAbortSignalAborted(signal)) {
        throw createAbortError();
      }

      const runtime = await this.runtimeLoader.getRuntime();

      if (isAbortSignalAborted(signal)) {
        throw createAbortError();
      }

      return await runtime.renderPage(input);
    } finally {
      release();
    }
  }

  async renderTile(
    input: PdfBackendRenderTileInput,
  ): Promise<KnexPdfCanvasRenderResult> {
    const priority = getRenderPriority(input);
    const phase = getRenderPhase(input);
    const signal = getRenderSignal(input);

    if (isAbortSignalAborted(signal)) {
      throw createAbortError();
    }

    await waitForIdle({
      priority,
      phase,
      signal,
    });

    const release = await pdfiumRenderSemaphore.acquire({
      priority,
      signal,
    });

    try {
      if (isAbortSignalAborted(signal)) {
        throw createAbortError();
      }

      const runtime = await this.runtimeLoader.getRuntime();

      if (typeof runtime.renderTile !== "function") {
        throw new Error("PDFium runtime does not expose renderTile.");
      }

      if (isAbortSignalAborted(signal)) {
        throw createAbortError();
      }

      return await runtime.renderTile(input);
    } finally {
      release();
    }
  }

  static getRenderQueueSnapshot() {
    return pdfiumRenderSemaphore.snapshot();
  }
}
