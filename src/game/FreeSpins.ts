import Phaser from 'phaser';
import { THEME } from '../constants';
import { gameConfig, type SpinTiming } from '../gameConfig';
import type { FreeSpinsRound, SymbolId } from '../rgs/types';
import { anticipation } from '../utils/anticipation';
import type { Layout } from '../utils/responsive';
import { Timeline } from '../utils/timeline';
import { FeastTable } from './FeastTable';
import { FeatureOverlay } from './FeatureOverlay';
import type { Reels } from './Reels';
import type { WinPresenter } from './animation/WinPresenter';
import { ANIM_EVENTS, type AnimationService } from './animation/AnimationService';
import { milestone } from './animation/FeatureAnimations';

type Strips = readonly (readonly SymbolId[])[];
/** What a tap does right now: overlay = fast-forward, spin = quick stop, present = skip win. */
type Phase = 'none' | 'overlay' | 'spin' | 'present';

const cfg = gameConfig.freeSpins;
const MILESTONES: readonly number[] = gameConfig.anim.feature.milestones;
const SUB = '#fff6a8';

/**
 * Free Spins presentation: plays back the spins already decided in the response.
 * Never computes a win: amounts come from spin.win / round.totalWin.
 */
export class FreeSpins {
  private scene: Phaser.Scene;
  private tl: Timeline;
  private ov: FeatureOverlay;
  private table: FeastTable;
  private phase: Phase = 'none';
  private slam = false;
  private mult = 1;

  constructor(
    scene: Phaser.Scene,
    private reels: Reels,
    private presenter: WinPresenter,
    private strips: { base: Strips; free: Strips },
    private anim: AnimationService,
  ) {
    this.scene = scene;
    this.tl = new Timeline(scene);
    this.ov = new FeatureOverlay(
      scene,
      // logo gold on a deep navy-red dim; the parol-red glow marks the feature
      { dim: 0x170818, edge: 0xffc23d, glow: THEME.glow.red, sub: SUB, stroke: THEME.stroke },
      anim,
    );
    this.table = new FeastTable(scene, anim);
  }

  /** True from intro to the end of the summary. */
  get active() {
    return this.phase !== 'none';
  }

  /** Player tap / spin button during the feature. */
  tap() {
    if (this.phase === 'spin') {
      this.slam = true;
      this.tl.skip(); // ends the minimum spin
      this.reels.slam();
    } else if (this.phase === 'present') {
      this.presenter.skip();
    } else if (this.phase === 'overlay') {
      this.tl.skip();
    }
  }

  /**
   * Intro, then every spin in the round. baseWin = amount already won by the triggering spin.
   * startAt > 0 resumes after a refresh: earlier spins are counted, not replayed.
   * onStep(n) fires once spin n has been fully presented.
   */
  async play(
    round: FreeSpinsRound,
    bet: number,
    baseWin: number,
    timing: SpinTiming,
    startAt = 0,
    onStep?: (done: number) => void,
  ) {
    this.phase = 'overlay';
    let shown = baseWin; // running meter value: sum of response amounts
    for (let i = 0; i < startAt; i++) shown += round.spins[i].win;
    this.presenter.showTotal(shown);
    const sub = startAt > 0 ? 'RESUMED' : `${round.awarded} SPINS`;
    this.anim.emit(ANIM_EVENTS.featureIntro, 'freeSpins');
    await this.ov.step(this.tl, 'FREE SPINS', sub, 'TAP TO START', cfg.introMs, 'intro');

    this.table.show(startAt, startAt > 0 ? round.spins[startAt - 1].spinsLeft : round.awarded);
    this.mult = round.spins[startAt]?.multiplier ?? 1; // a round's starting value never flies in
    this.reels.setStrips(this.strips.free);
    this.presenter.clearLines();
    for (let i = startAt; i < round.spins.length; i++) {
      const s = round.spins[i];
      this.setBar(Math.max(0, s.spinsLeft - s.retrigger), s.multiplier);

      this.phase = 'spin';
      this.slam = false;
      this.tl.reset();
      this.presenter.clearLines();
      this.reels.spin(timing);
      await this.tl.wait(timing.minSpinMs);
      await this.reels.stop(s.stops, s.grid, this.slam, anticipation(s.grid, false));
      this.tl.reset();

      if (s.win > 0) {
        this.phase = 'present';
        await this.presenter.present(s.lineWins, s.win, bet, shown);
        shown += s.win;
      }
      this.phase = 'overlay';
      if (s.retrigger > 0) {
        await this.ov.step(this.tl, `+${s.retrigger}`, 'FREE SPINS', '', cfg.bannerMs, 'drop');
        this.setBar(s.spinsLeft, s.multiplier);
        this.ov.flipBar('left');
      }
      this.table.fill(i + 1, s.spinsLeft);
      onStep?.(i + 1);
      await this.tl.wait(cfg.spinGapMs);
      this.tl.reset();
    }
    if (import.meta.env.DEV && shown !== baseWin + round.totalWin)
      console.warn(`[fs] played ${shown - baseWin} != round total ${round.totalWin}`);
  }

  /** Summary overlay; leaves the meter on the round total from the response. */
  async summary(round: FreeSpinsRound, totalWin: number) {
    this.phase = 'overlay';
    this.table.sparkle();
    // capped: the response already ended the feature early; say so instead of a normal summary
    await this.ov.summary(
      this.tl,
      round.capped ? 'MAX WIN REACHED' : 'FREE SPINS WIN',
      round.totalWin,
      round.capped ? 'FEATURE ENDED AT MAX WIN' : 'TAP TO CONTINUE',
      cfg.summaryCountUpMs,
      cfg.summaryHoldMs,
    );
    this.ov.bar(null);
    this.table.hide();
    this.presenter.clearLines();
    this.presenter.showTotal(totalWin);
    this.reels.setStrips(this.strips.base);
    this.phase = 'none';
  }

  /** A raised multiplier flies in as '+n' from the reels; the pill shows the old value until it lands. */
  private setBar(left: number, mult: number) {
    const up = mult > this.mult;
    this.ov.bar(`FREE SPINS ${left}`, `MULTIPLIER x${up ? this.mult : mult}`);
    if (up)
      this.ov.fly(`+${mult - this.mult}`, 'right', `MULTIPLIER x${mult}`, (t) => {
        this.anim.emit(ANIM_EVENTS.multiplierTick, mult);
        if (MILESTONES.includes(mult)) milestone(this.scene, this.anim, t, SUB);
      });
    this.mult = mult;
  }

  relayout(l: Layout) {
    this.ov.relayout(l);
    this.table.relayout(l);
  }
}
