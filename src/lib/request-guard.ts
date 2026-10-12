export class RequestGuard {
  private revision = 0;
  private controller: AbortController | null = null;
  invalidate() {
    this.revision++;
    this.controller?.abort();
    this.controller = null;
  }
  start() {
    this.invalidate();
    const revision = this.revision;
    this.controller = new AbortController();
    return { signal: this.controller.signal, isCurrent: () => revision === this.revision };
  }
}
