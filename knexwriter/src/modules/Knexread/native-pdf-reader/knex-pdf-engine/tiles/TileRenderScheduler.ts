type TileRenderSchedulerTask<T> = {
  id: number;
  priority: number;
  createdAt: number;
  signal?: AbortSignal;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  abortListener?: () => void;
};

export type TileRenderSchedulerOptions = {
  maxConcurrency?: number;

  /**
   * Limite máximo de tarefas aguardando na fila.
   *
   * Em zoom alto, cada tarefa pode segurar closures com session, geometry,
   * tile, canvas e generationId. Uma fila sem limite pode reter muita memória
   * mesmo antes de renderizar.
   */
  maxQueuedTasks?: number;

  /**
   * Tempo máximo para uma tarefa permanecer aguardando.
   *
   * Tarefas antigas geralmente pertencem a gerações de zoom que já ficaram
   * obsoletas. Mantê-las na fila aumenta memória e pode renderizar tiles que o
   * usuário já não verá.
   */
  maxQueuedTaskAgeMs?: number;

  /**
   * Intervalo mínimo entre bombas da fila.
   *
   * Usar RAF/pequeno atraso entre tarefas evita que uma sequência de tiles
   * ocupe o main thread em rajadas e prejudique o scroll/zoom.
   */
  pumpDelayMs?: number;

  /**
   * Quando true, a fila bombeia em requestAnimationFrame no navegador.
   *
   * Isso dá oportunidade para o browser aplicar scroll/layout/paint antes de
   * iniciar a próxima tarefa de renderização.
   */
  useAnimationFramePump?: boolean;
};

function createAbortError() {
  return new DOMException("Tile render aborted.", "AbortError");
}

function createQueueOverflowError() {
  return new DOMException("Tile render queue overflow.", "AbortError");
}

const DEFAULT_MAX_CONCURRENCY = 1;
const DEFAULT_MAX_QUEUED_TASKS = 96;
const DEFAULT_MAX_QUEUED_TASK_AGE_MS = 6_000;
const DEFAULT_PUMP_DELAY_MS = 8;
const DEFAULT_USE_ANIMATION_FRAME_PUMP = true;

function safePositiveInteger(
  value: number | null | undefined,
  fallback: number,
): number {
  return Math.max(1, Math.trunc(Number.isFinite(value) ? Number(value) : fallback));
}

export class TileRenderScheduler {
  private readonly maxConcurrency: number;
  private readonly maxQueuedTasks: number;
  private readonly maxQueuedTaskAgeMs: number;
  private readonly pumpDelayMs: number;
  private readonly useAnimationFramePump: boolean;
  private nextTaskId = 1;
  private activeCount = 0;
  private pumpScheduled = false;
  private readonly queue: TileRenderSchedulerTask<unknown>[] = [];

  constructor(options: TileRenderSchedulerOptions = {}) {
    this.maxConcurrency = safePositiveInteger(
      options.maxConcurrency,
      DEFAULT_MAX_CONCURRENCY,
    );
    this.maxQueuedTasks = safePositiveInteger(
      options.maxQueuedTasks,
      DEFAULT_MAX_QUEUED_TASKS,
    );
    this.maxQueuedTaskAgeMs = safePositiveInteger(
      options.maxQueuedTaskAgeMs,
      DEFAULT_MAX_QUEUED_TASK_AGE_MS,
    );
    this.pumpDelayMs = Math.max(
      0,
      Math.trunc(
        typeof options.pumpDelayMs === "number" &&
          Number.isFinite(options.pumpDelayMs)
          ? options.pumpDelayMs
          : DEFAULT_PUMP_DELAY_MS,
      ),
    );
    this.useAnimationFramePump =
      options.useAnimationFramePump ?? DEFAULT_USE_ANIMATION_FRAME_PUMP;
  }

  get queuedCount() {
    return this.queue.length;
  }

  get runningCount() {
    return this.activeCount;
  }

  get maxQueueSize() {
    return this.maxQueuedTasks;
  }

  enqueue<T>(input: {
    priority?: number;
    signal?: AbortSignal;
    run: () => Promise<T>;
  }): Promise<T> {
    if (input.signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    return new Promise<T>((resolve, reject) => {
      const task: TileRenderSchedulerTask<T> = {
        id: this.nextTaskId,
        priority: input.priority ?? 0,
        createdAt: Date.now(),
        signal: input.signal,
        run: input.run,
        resolve,
        reject,
      };

      this.nextTaskId += 1;

      if (input.signal) {
        task.abortListener = () => {
          const removed = this.removeTask(task as TileRenderSchedulerTask<unknown>);
          if (removed) {
            reject(createAbortError());
          }
        };
        input.signal.addEventListener("abort", task.abortListener, {
          once: true,
        });
      }

      this.queue.push(task as TileRenderSchedulerTask<unknown>);
      this.pruneQueue();
      this.schedulePump();
    });
  }

  clear() {
    for (const task of [...this.queue]) {
      this.removeTask(task);
      task.reject(createAbortError());
    }
  }

  /**
   * Remove itens abortados, antigos e excesso de fila.
   *
   * A política de excesso remove primeiro:
   * - tarefas abortadas;
   * - tarefas mais antigas;
   * - tarefas de menor prioridade.
   *
   * Isso favorece a página/tiles mais importantes sem deixar gerações antigas
   * acumularem memória.
   */
  private pruneQueue() {
    const now = Date.now();

    for (const task of [...this.queue]) {
      const isAborted = task.signal?.aborted === true;
      const isStale = now - task.createdAt > this.maxQueuedTaskAgeMs;

      if (isAborted || isStale) {
        this.removeTask(task);
        task.reject(createAbortError());
      }
    }

    if (this.queue.length <= this.maxQueuedTasks) return;

    const overflowCount = this.queue.length - this.maxQueuedTasks;

    const dropCandidates = [...this.queue].sort(
      (a, b) =>
        a.priority - b.priority ||
        a.createdAt - b.createdAt ||
        a.id - b.id,
    );

    for (const task of dropCandidates.slice(0, overflowCount)) {
      this.removeTask(task);
      task.reject(createQueueOverflowError());
    }
  }

  private removeTask(task: TileRenderSchedulerTask<unknown>): boolean {
    const index = this.queue.indexOf(task);
    const removed = index >= 0;

    if (removed) {
      this.queue.splice(index, 1);
    }

    this.detachAbortListener(task);

    return removed;
  }

  private detachAbortListener(task: TileRenderSchedulerTask<unknown>) {
    if (task.signal && task.abortListener) {
      task.signal.removeEventListener("abort", task.abortListener);
      task.abortListener = undefined;
    }
  }

  private schedulePump() {
    if (this.pumpScheduled) return;

    this.pumpScheduled = true;

    const run = () => {
      this.pumpScheduled = false;
      this.pump();
    };

    if (typeof window === "undefined") {
      setTimeout(run, this.pumpDelayMs);
      return;
    }

    if (
      this.useAnimationFramePump &&
      typeof window.requestAnimationFrame === "function"
    ) {
      if (this.pumpDelayMs <= 0) {
        window.requestAnimationFrame(run);
        return;
      }

      window.setTimeout(() => {
        window.requestAnimationFrame(run);
      }, this.pumpDelayMs);
      return;
    }

    window.setTimeout(run, this.pumpDelayMs);
  }

  private pump() {
    this.pruneQueue();

    this.queue.sort(
      (a, b) =>
        b.priority - a.priority ||
        a.createdAt - b.createdAt ||
        a.id - b.id,
    );

    while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      this.detachAbortListener(task);

      if (task.signal?.aborted) {
        task.reject(createAbortError());
        continue;
      }

      this.activeCount += 1;

      task
        .run()
        .then(task.resolve, task.reject)
        .finally(() => {
          this.activeCount = Math.max(0, this.activeCount - 1);
          this.schedulePump();
        });
    }
  }
}
