import Phaser from 'phaser';
import { SFX } from '../assets';
import { RELAYOUT } from '../constants';
import { ErrorModal } from '../game/ErrorModal';
import { FreeSpins } from '../game/FreeSpins';
import { HoldAndWin } from '../game/HoldAndWin';
import { Hud } from '../game/Hud';
import { Paytable } from '../game/Paytable';
import { Reels } from '../game/Reels';
import { WinLines } from '../game/WinLines';
import { WinPresenter } from '../game/WinPresenter';
import { SoundManager } from '../game/SoundManager';
import { gameConfig, type SpinTiming } from '../gameConfig';
import { RGSError, type RGS } from '../rgs/RGS';
import type { SpinResponse } from '../rgs/types';
import { SlotStateMachine } from '../state/SlotStateMachine';
import { anticipation } from '../utils/anticipation';
import { clearProgress, loadProgress, saveProgress } from '../utils/progress';
import { layout, type Layout } from '../utils/responsive';

/** Largest frame step fed to animations, so a background tab doesn't teleport reels. */
const MAX_DT = 50;

/** Wiring only: creates modules, talks to the RGS, drives the state machine. */
export class GameScene extends Phaser.Scene {
  private fsm = new SlotStateMachine();
  private reels?: Reels;
  private winLines?: WinLines;
  private presenter?: WinPresenter;
  private freeSpins?: FreeSpins;
  private holdAndWin?: HoldAndWin;
  private hud!: Hud;
  private sfx!: SoundManager;
  private errorModal!: ErrorModal;
  private paytable!: Paytable;
  private sessionId = '';
  private betLevels: readonly number[] = [];
  private bet = gameConfig.defaultBet;
  /** last balance confirmed by the RGS, minor units */
  private balance = 0;
  private turbo = false;
  /** deferred assets (audio) loaded; spin stays in 'loading' until then */
  private ready = false;
  /** player asked for a quick stop this round */
  private slam = false;
  private minSpinTimer?: Phaser.Time.TimerEvent;

  constructor(private rgs: RGS) {
    super('Game');
    if (import.meta.env.DEV) this.fsm.on((from, to) => console.log(`[fsm] ${from} -> ${to}`));
  }

  async create() {
    this.game.events.on(RELAYOUT, this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(RELAYOUT, this.relayout, this),
    );

    this.sfx = new SoundManager(this);
    const click = (fn: () => void) => () => {
      fn();
      this.sfx.play('click');
    };
    this.hud = new Hud(this, {
      spin: () => this.onSpinPressed(),
      betDown: click(() => this.changeBet(-1)),
      betUp: click(() => this.changeBet(1)),
      turbo: click(() => this.hud.setTurbo((this.turbo = !this.turbo))),
      mute: click(() => this.hud.setMuted(this.sfx.toggleMute())),
      info: click(() => this.fsm.state === 'Idle' && this.paytable.open(this.bet)),
    });
    this.hud.setMuted(this.sfx.isMuted);
    this.errorModal = new ErrorModal(this);
    this.paytable = new Paytable(this);
    this.relayout(layout); // place HUD before awaiting init, or it sits at (0,0) meanwhile
    this.loadDeferred();

    const init = await this.rgs.init();
    this.sessionId = init.sessionId;
    this.betLevels = init.betLevels;
    if (!this.betLevels.includes(this.bet)) this.bet = this.betLevels[0];
    this.balance = init.balance;
    this.hud.setBalance(this.balance);

    const strips = init.reelStrips.base;
    const grid = init.unfinished?.grid ?? strips.map((s) => [s[0], s[1], s[2]]);
    this.reels = new Reels(this, strips, grid);
    this.winLines = new WinLines(this, this.reels);
    this.presenter = new WinPresenter(this, this.winLines);
    this.freeSpins = new FreeSpins(this, this.reels, this.presenter, init.reelStrips);
    this.holdAndWin = new HoldAndWin(this, this.presenter);
    this.reels.hooks = {
      spin: () => this.sfx.play('spin'),
      land: () => {
        this.sfx.stop('tease');
        this.sfx.play('stop');
      },
      tease: () => this.sfx.play('tease'),
    };
    this.presenter.onWin = (big) => this.sfx.play(big ? 'bigwin' : 'win');
    this.holdAndWin.onCoin = () => this.sfx.play('coin');
    // tap anywhere skips / fast-forwards whatever is presenting
    this.input.on('pointerdown', () => this.onTap());
    this.relayout(layout);

    if (init.unfinished) await this.resume(init.unfinished);
    else this.toIdle();
  }

  update(_time: number, delta: number) {
    this.reels?.update(Math.min(delta, MAX_DT));
  }

  /** Deferred manifest: fetched while the player sits on Idle. A failed file never blocks play. */
  private loadDeferred() {
    for (const key in SFX) this.load.audio(key, SFX[key as keyof typeof SFX]);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => this.hud.setLoading(p));
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.ready = true;
      this.sfx.init();
      if (this.fsm.state === 'Idle') this.hud.setSpinMode(this.idleSpinMode());
    });
    this.hud.setLoading(0);
    this.load.start();
  }

  private idleSpinMode() {
    if (!this.ready) return 'loading';
    return this.balance >= this.bet ? 'spin' : 'off';
  }

  /** The only way into Idle: re-enables controls against the confirmed balance. */
  private toIdle() {
    this.fsm.to('Idle');
    this.refreshBet();
    this.hud.setSpinMode(this.idleSpinMode());
  }

  private refreshBet() {
    const idle = this.fsm.state === 'Idle';
    const i = this.betLevels.indexOf(this.bet);
    this.hud.setBet(this.bet, idle && i > 0, idle && i < this.betLevels.length - 1);
    this.hud.setInfoEnabled(idle);
  }

  private changeBet(dir: -1 | 1) {
    if (this.fsm.state !== 'Idle') return;
    const i = this.betLevels.indexOf(this.bet) + dir;
    if (i < 0 || i >= this.betLevels.length) return;
    this.bet = this.betLevels[i];
    this.refreshBet();
    this.hud.setSpinMode(this.idleSpinMode());
  }

  private onTap() {
    if (this.paytable.isOpen) return; // taps belong to the modal
    if (this.freeSpins!.active) this.freeSpins!.tap();
    else if (this.holdAndWin!.active) this.holdAndWin!.tap();
    else if (this.fsm.state === 'WinPresentation') this.presenter!.skip();
  }

  private onSpinPressed() {
    if (this.paytable.isOpen) return;
    const s = this.fsm.state;
    if (this.freeSpins!.active) return this.freeSpins!.tap();
    if (this.holdAndWin!.active) return this.holdAndWin!.tap();
    if (s === 'Spinning' || s === 'Stopping') {
      this.slam = true;
      this.minSpinTimer?.remove(true); // skip the rest of the minimum spin
      this.reels!.slam();
      return;
    }
    if (s === 'WinPresentation') this.presenter!.skip();
    if (s === 'Idle' && this.ready && this.balance >= this.bet) void this.playRound();
  }

  private async playRound() {
    const reels = this.reels!;
    const timing = this.timing();
    this.slam = false;
    this.presenter!.clear();
    this.fsm.to('Spinning');
    this.refreshBet();
    this.hud.setSpinMode('stop');
    this.hud.setBalance(this.balance - this.bet); // stake shown as taken; RGS balance arrives with the result
    reels.spin(timing);

    // visual spin and RGS request run in parallel; stop once both min time and response are in
    const minSpin = this.wait(timing.minSpinMs);
    const res = await this.requestSpin(timing);
    if (!res) return;
    await minSpin;

    this.fsm.to('Stopping');
    await reels.stop(res.stops, res.grid, this.slam, anticipation(res.grid, true));
    if (import.meta.env.DEV && !reels.shows(res.grid))
      console.warn('[reels] landed grid != response grid');
    this.fsm.to('Evaluating');
    await this.presentRound(res);
  }

  /**
   * Refresh with an unfinished round: show its grid and present it again from the response.
   * If a feature had started, playback continues at the persisted step instead of replaying.
   */
  private async resume(res: SpinResponse) {
    if (import.meta.env.DEV) console.log(`[resume] ${res.roundId}`);
    if (this.betLevels.includes(res.bet)) this.bet = res.bet;
    this.refreshBet();
    this.hud.setBalance(res.balance - res.totalWin); // the stake is already taken, the win not yet shown
    this.fsm.to('Evaluating');
    await this.presentRound(res, loadProgress(res.roundId));
  }

  /** Evaluating -> base win -> feature -> complete -> Idle. featureFrom = resume point inside the feature. */
  private async presentRound(res: SpinResponse, featureFrom?: number) {
    const f = res.feature;
    const timing = this.timing();
    if (import.meta.env.DEV)
      console.log(`[round] ${res.roundId} win ${res.totalWin} feature ${f?.type ?? '-'}`);

    if (featureFrom === undefined && res.baseWin > 0) {
      this.fsm.to('WinPresentation');
      this.hud.setSpinMode('spin'); // tap = skip
      await this.presenter!.present(res.lineWins, res.baseWin, res.bet);
    } else {
      this.presenter!.showTotal(res.baseWin);
    }

    const save = (step: number) => saveProgress(res.roundId, step);
    if (f?.type === 'freeSpins') {
      const from = Math.min(featureFrom ?? 0, f.spins.length);
      save(from);
      this.sfx.play('feature');
      this.fsm.to('FreeSpins');
      this.hud.setSpinMode('stop'); // tap = quick stop / skip
      await this.freeSpins!.play(f, res.bet, res.baseWin, timing, from, save);
      this.fsm.to('WinPresentation');
      this.sfx.play('bigwin');
      await this.freeSpins!.summary(f, res.totalWin);
    }
    if (f?.type === 'holdAndWin') {
      const from = Math.min(featureFrom ?? 0, f.respins.length);
      save(from);
      this.sfx.play('feature');
      this.fsm.to('HoldAndWin');
      this.hud.setSpinMode('spin'); // tap = fast-forward
      await this.holdAndWin!.play(f, this.turbo, from, save);
      this.fsm.to('WinPresentation');
      this.sfx.play('bigwin');
      await this.holdAndWin!.summary(f, res.totalWin);
    }
    if (import.meta.env.DEV && this.presenter!.shown !== res.totalWin)
      console.warn(`[win] displayed ${this.presenter!.shown} != response ${res.totalWin}`);

    await this.rgs.complete(res.roundId);
    clearProgress();
    this.balance = res.balance;
    this.hud.setBalance(this.balance, true);
    this.toIdle();
    if (!f) this.winLines!.cycle(res.lineWins); // after a feature the reels no longer show the base grid
  }

  /** Spin request with retry. Network errors retry (safe: RGS returns a committed round); others abort. */
  private async requestSpin(timing: SpinTiming): Promise<SpinResponse | undefined> {
    for (;;) {
      try {
        return await this.rgs.spin({ sessionId: this.sessionId, bet: this.bet });
      } catch (e) {
        const retryable = !(e instanceof RGSError) || e.code === 'network';
        this.reels!.halt();
        this.hud.setSpinMode('off');
        this.fsm.to('Error');
        if (!retryable) {
          await this.errorModal.show(`Spin rejected\n(${(e as RGSError).code})`, 'OK');
          this.hud.setBalance(this.balance); // nothing was staked
          this.toIdle();
          return undefined;
        }
        await this.errorModal.show('Connection lost.\nYour balance is safe.', 'RETRY');
        this.fsm.to('Spinning');
        this.hud.setSpinMode('stop');
        this.reels!.spin(timing);
      }
    }
  }

  private timing() {
    return this.turbo ? gameConfig.turbo : gameConfig.timing;
  }

  /** Delay that a quick stop can end early. */
  private wait(ms: number) {
    return new Promise<void>((resolve) => {
      this.minSpinTimer = this.time.delayedCall(ms, resolve);
    });
  }

  private relayout(l: Layout) {
    this.reels?.relayout(l);
    this.hud?.relayout(l);
    this.errorModal?.relayout(l);
    this.paytable?.relayout();
    this.winLines?.relayout();
    this.presenter?.relayout(l);
    this.freeSpins?.relayout(l);
    this.holdAndWin?.relayout(l);
  }
}
