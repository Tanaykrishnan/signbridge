export type PlaybackPhase = 'idle' | 'playing' | 'paused' | 'complete';
export type Segment = { id: string; duration: number };
export type PlaybackSnapshot = {
  time: number;
  duration: number;
  index: number;
  localTime: number;
  phase: PlaybackPhase;
  speed: number;
  revision: number;
  transitionFrom: number | null;
};
export class PlaybackEngine {
  private segments: Segment[] = [];
  private starts: number[] = [];
  private listeners = new Set<() => void>();
  private elapsedSinceEmit = 0;
  private state: PlaybackSnapshot = {
    time: 0,
    duration: 0,
    index: 0,
    localTime: 0,
    phase: 'idle',
    speed: 1,
    revision: 0,
    transitionFrom: null,
  };
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.state;
  private publish(patch: Partial<PlaybackSnapshot> = {}, notify = true) {
    this.state = { ...this.state, ...patch, revision: this.state.revision + 1 };
    if (notify) this.listeners.forEach((fn) => fn());
  }
  setSequence(segments: Segment[]) {
    if (segments.some((s) => !Number.isFinite(s.duration) || s.duration <= 0))
      throw new Error('Invalid segment duration');
    this.segments = segments.map((s) => ({ ...s }));
    let duration = 0;
    this.starts = segments.map((s) => {
      const start = duration;
      duration += s.duration;
      return start;
    });
    this.publish({
      time: 0,
      duration,
      index: 0,
      localTime: 0,
      phase: 'idle',
      transitionFrom: null,
    });
  }
  play() {
    if (!this.state.duration) return;
    if (this.state.phase === 'complete') this.seek(0);
    this.publish({ phase: 'playing' });
  }
  pause() {
    if (this.state.phase === 'playing') this.publish({ phase: 'paused' });
  }
  resume() {
    this.play();
  }
  stop() {
    this.seek(0);
    this.publish({ phase: 'idle' });
  }
  setSpeed(speed: number) {
    if (!Number.isFinite(speed) || speed < 0.25 || speed > 2)
      throw new Error('Invalid playback speed');
    this.publish({ speed });
  }
  seek(seconds: number, notify = true, continuous = false) {
    if (!Number.isFinite(seconds)) return;
    const time = Math.min(this.state.duration, Math.max(0, seconds));
    let low = 0;
    let high = this.starts.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.starts[middle] <= time) low = middle + 1;
      else high = middle;
    }
    const index = Math.max(0, low - 1);
    const start = this.starts[index] ?? 0;
    this.publish(
      {
        time,
        index,
        localTime: Math.max(0, time - start),
        transitionFrom: continuous
          ? index !== this.state.index
            ? this.state.index
            : this.state.transitionFrom
          : null,
        phase:
          time === this.state.duration && time > 0
            ? 'complete'
            : this.state.phase === 'complete'
              ? 'paused'
              : this.state.phase,
      },
      notify || index !== this.state.index || time === this.state.duration,
    );
  }
  seekIndex(index: number) {
    const target = Math.max(0, Math.min(this.segments.length - 1, index));
    this.seek(this.starts[target] ?? 0);
  }
  next() {
    this.seekIndex(this.state.index + 1);
  }
  previous() {
    this.seekIndex(this.state.index - 1);
  }
  tick(delta: number) {
    if (this.state.phase !== 'playing' || !Number.isFinite(delta) || delta < 0) return;
    this.elapsedSinceEmit += delta;
    const emit = this.elapsedSinceEmit >= 0.08;
    if (emit) this.elapsedSinceEmit = 0;
    this.seek(this.state.time + Math.min(delta, 0.2) * this.state.speed, emit, true);
  }
}
