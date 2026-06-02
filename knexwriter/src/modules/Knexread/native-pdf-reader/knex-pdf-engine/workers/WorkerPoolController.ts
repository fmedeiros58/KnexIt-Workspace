export class WorkerPoolController {
  constructor(readonly workerCount: number) {}

  isAvailable() {
    return typeof Worker !== "undefined" && this.workerCount > 0;
  }
}
