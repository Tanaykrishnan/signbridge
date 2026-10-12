import { describe, expect, it } from 'vitest';
import { RequestGuard } from '../src/lib/request-guard';
describe('request ownership', () => {
  it('aborts and rejects stale work when the input changes', () => {
    const guard = new RequestGuard();
    const first = guard.start();
    guard.invalidate();
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
  });
  it('lets only the newest request commit its result', () => {
    const guard = new RequestGuard();
    const first = guard.start();
    const second = guard.start();
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
    expect(second.signal.aborted).toBe(false);
  });
});
