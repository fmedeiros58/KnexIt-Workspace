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
};

function createAbortError() {
  return new DOMException("Tile render aborted.", "AbortError");
}

export class TileRenderScheduler {
  private readonly maxConcurrency: number;
  private nextTaskId = 1;
  private activeCount = 0;
  private pumpScheduled = false;
  private readonly queue: TileRenderSchedulerTask<unknown>[] = [];

  constructor(options: TileRenderSchedulerOptions = {}) {
    this.maxConcurrency = Math.max(1, Math.trunc(options.maxConcurrency ?? 2));
  }

  get queuedCount() {
    return this.queue.length;
  }

  get runningCount() {
    return this.activeCount;
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
          this.removeTask(task as TileRenderSchedulerTask<unknown>);
          reject(createAbortError());
        };
        input.signal.addEventListener("abort", task.abortListener, {
          once: true,
        });
      }

      this.queue.push(task as TileRenderSchedulerTask<unknown>);
      this.schedulePump();
    });
  }

  clear() {
    for (const task of [...this.queue]) {
      this.removeTask(task);
      task.reject(createAbortError());
    }
  }

  private removeTask(task: TileRenderSchedulerTask<unknown>) {
    const index = this.queue.indexOf(task);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }

    if (task.signal && task.abortListener) {
      task.signal.removeEventListener("abort", task.abortListener);
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
      setTimeout(run, 0);
      return;
    }

    window.setTimeout(run, 0);
  }

  private pump() {
    this.queue.sort(
      (a, b) =>
        b.priority - a.priority ||
        a.createdAt - b.createdAt ||
        a.id - b.id,
    );

    while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

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
