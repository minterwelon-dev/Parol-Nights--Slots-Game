import Phaser from 'phaser';

/**
 * Skippable presentation steps. skip() resolves the running step at once and every later
 * step resolves immediately until reset(). Steps never apply end state themselves: the caller
 * sets final values from the response after each await, so a skip can't desync anything.
 */
export class Timeline {
  private skipping = false;
  /** finishers of running steps */
  private active = new Set<() => void>();

  constructor(private scene: Phaser.Scene) {}

  skip() {
    this.skipping = true;
    for (const finish of [...this.active]) finish();
  }

  /** Start a new skippable stage (e.g. after a count-up, the hold that follows). */
  reset() {
    this.skipping = false;
  }

  wait(ms: number): Promise<void> {
    if (this.skipping || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = this.scene.time.delayedCall(ms, () => finish());
      const finish = () => {
        timer.remove(false);
        this.active.delete(finish);
        resolve();
      };
      this.active.add(finish);
    });
  }

  /** Number tween from -> to; onUpdate receives the current value. */
  counter(
    from: number,
    to: number,
    ms: number,
    onUpdate: (v: number) => void,
    ease = 'Sine.easeOut',
  ): Promise<void> {
    if (this.skipping || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const tween = this.scene.tweens.addCounter({
        from,
        to,
        duration: ms,
        ease,
        onUpdate: (t) => onUpdate(t.getValue() ?? to),
        onComplete: () => finish(),
      });
      const finish = () => {
        tween.stop();
        this.active.delete(finish);
        resolve();
      };
      this.active.add(finish);
    });
  }
}
