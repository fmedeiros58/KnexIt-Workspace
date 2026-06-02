import {
  PDFIUM_FINAL_RENDER_WARNING_MS,
  PDFIUM_INTERACTIVE_RENDER_BUDGET_MS,
} from "./RenderQualityController";

export {
  PDFIUM_FINAL_RENDER_WARNING_MS,
  PDFIUM_INTERACTIVE_RENDER_BUDGET_MS,
} from "./RenderQualityController";

type KnexPdfQueuedRenderBackend = "pdfjs" | "pdfium" | string;

type QueuedRenderTask<T> = {
  id: number;
  backend: KnexPdfQueuedRenderBackend;
  priority: number;
  createdAt: number;
  signal?: AbortSignal;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  abortListener?: () => void;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (
    callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
    options?: { timeout?: number },
  ) => number;
};

const PDFIUM_MAX_CONCURRENT_RENDERS = 1;
const PDFJS_MAX_CONCURRENT_RENDERS = 2;
const IDLE_RENDER_TIMEOUT_MS = 700;

let nextTaskId = 1;
let activePdfiumRenders = 0;
let activePdfJsRenders = 0;
let pumpScheduled = false;

const queue: QueuedRenderTask<unknown>[] = [];

function isPdfiumLikeBackend(backend: string) {
  return backend === "pdfium";
}

function getMaxConcurrentRenders(backend: string) {
  return isPdfiumLikeBackend(backend)
    ? PDFIUM_MAX_CONCURRENT_RENDERS
    : PDFJS_MAX_CONCURRENT_RENDERS;
}

function getActiveRenderCount(backend: string) {
  return isPdfiumLikeBackend(backend)
    ? activePdfiumRenders
    : activePdfJsRenders;
}

function incrementActiveRenderCount(backend: string) {
  if (isPdfiumLikeBackend(backend)) {
    activePdfiumRenders += 1;
    return;
  }

  activePdfJsRenders += 1;
}

function decrementActiveRenderCount(backend: string) {
  if (isPdfiumLikeBackend(backend)) {
    activePdfiumRenders = Math.max(0, activePdfiumRenders - 1);
    return;
  }

  activePdfJsRenders = Math.max(0, activePdfJsRenders - 1);
}

function createAbortError() {
  return new DOMException("Render aborted", "AbortError");
}

function sortQueue() {
  queue.sort(
    (a, b) =>
      b.priority - a.priority ||
      a.createdAt - b.createdAt ||
      a.id - b.id,
  );
}

function removeTask(task: QueuedRenderTask<unknown>) {
  const index = queue.indexOf(task);
  if (index >= 0) {
    queue.splice(index, 1);
  }

  if (task.signal && task.abortListener) {
    task.signal.removeEventListener("abort", task.abortListener);
  }
}

function schedulePump() {
  if (pumpScheduled) return;

  pumpScheduled = true;

  const run = () => {
    pumpScheduled = false;
    pumpQueue();
  };

  if (typeof window === "undefined") {
    setTimeout(run, 0);
    return;
  }

  const idleWindow = window as WindowWithIdleCallback;
  if (typeof idleWindow.requestIdleCallback === "function") {
    idleWindow.requestIdleCallback(() => run(), {
      timeout: IDLE_RENDER_TIMEOUT_MS,
    });
    return;
  }

  window.setTimeout(run, 0);
}

function startTask(task: QueuedRenderTask<unknown>) {
  removeTask(task);

  if (task.signal?.aborted) {
    task.reject(createAbortError());
    return;
  }

  incrementActiveRenderCount(task.backend);

  task
    .task()
    .then(task.resolve, task.reject)
    .finally(() => {
      decrementActiveRenderCount(task.backend);
      schedulePump();
    });
}

function pumpQueue() {
  sortQueue();

  for (const task of [...queue]) {
    if (task.signal?.aborted) {
      removeTask(task);
      task.reject(createAbortError());
      continue;
    }

    const activeCount = getActiveRenderCount(task.backend);
    const maxConcurrent = getMaxConcurrentRenders(task.backend);

    if (activeCount >= maxConcurrent) {
      continue;
    }

    startTask(task);
  }

  if (queue.length > 0) {
    schedulePump();
  }
}

export function runKnexPdfRenderTask<T>(input: {
  backend: KnexPdfQueuedRenderBackend;
  priority?: number;
  signal?: AbortSignal;
  task: () => Promise<T>;
}): Promise<T> {
  if (input.signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise<T>((resolve, reject) => {
    const task: QueuedRenderTask<T> = {
      id: nextTaskId,
      backend: input.backend,
      priority: input.priority ?? 0,
      createdAt: Date.now(),
      signal: input.signal,
      task: input.task,
      resolve,
      reject,
    };

    nextTaskId += 1;

    if (input.signal) {
      task.abortListener = () => {
        removeTask(task as QueuedRenderTask<unknown>);
        reject(createAbortError());
      };
      input.signal.addEventListener("abort", task.abortListener, {
        once: true,
      });
    }

    queue.push(task as QueuedRenderTask<unknown>);
    schedulePump();
  });
}
