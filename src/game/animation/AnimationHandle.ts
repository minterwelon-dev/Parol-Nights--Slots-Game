/** Anything a handle can stop: a tween, an emitter, or an adapter around a timer. */
export interface Stoppable {
  stop(): unknown;
}

/**
 * Cancellable animation (ANIMATION_SPEC.md section 2). finish() jumps to the correct end state,
 * cancel() resets to neutral; both stop every part and resolve `done`. Phaser-free, so the
 * Node self-checks can exercise it.
 */
export class AnimationHandle {
  readonly done: Promise<void>;
  private resolve!: () => void;
  private parts: Stoppable[] = [];
  private finals: (() => void)[] = [];
  private neutrals: (() => void)[] = [];
  private settled = false;

  constructor() {
    this.done = new Promise((r) => (this.resolve = r));
  }

  get active() {
    return !this.settled;
  }

  /** Track a part. final runs on finish(), neutral on cancel(). Added after settling: stopped at once. */
  add(part: Stoppable | null, final?: () => void, neutral?: () => void) {
    if (this.settled) {
      part?.stop();
      return this;
    }
    if (part) this.parts.push(part);
    if (final) this.finals.push(final);
    if (neutral) this.neutrals.push(neutral);
    return this;
  }

  /** The parts ended on their own: their end state is already on screen. */
  complete() {
    this.settle();
  }

  finish() {
    if (this.settled) return;
    this.stopParts();
    for (const f of this.finals) f();
    this.settle();
  }

  cancel() {
    if (this.settled) return;
    this.stopParts();
    for (const f of this.neutrals) f();
    this.settle();
  }

  /** One handle over many: done when all are done; finish / cancel reach every one. */
  static all(handles: readonly AnimationHandle[]) {
    const h = new AnimationHandle();
    for (const c of handles)
      h.add(
        { stop: () => {} },
        () => c.finish(),
        () => c.cancel(),
      );
    void Promise.all(handles.map((c) => c.done)).then(() => h.complete());
    return h;
  }

  private stopParts() {
    for (const p of this.parts) p.stop();
  }

  private settle() {
    this.settled = true;
    this.parts.length = 0;
    this.finals.length = 0;
    this.neutrals.length = 0;
    this.resolve();
  }
}
