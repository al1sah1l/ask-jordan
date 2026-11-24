/** Allow normal API work concurrently, but drain it before removing account state. */
export class ApplicationRequestGate {
  private barrier: Promise<void> = Promise.resolve();
  private readonly active = new Set<Promise<unknown>>();

  run<T>(operation: () => Promise<T>, exclusive = false): Promise<T> {
    const ready = exclusive
      ? Promise.allSettled([...this.active, this.barrier]).then(() => {})
      : this.barrier;
    const result = ready.then(operation);
    if (exclusive) this.barrier = result.then(() => {}, () => {});
    this.active.add(result);
    void result.then(() => this.active.delete(result), () => this.active.delete(result));
    return result;
  }
}
