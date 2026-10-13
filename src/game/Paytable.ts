import Phaser from 'phaser';
import { DEPTH, MODAL_LAYOUT, THEME } from '../constants';
import { gameConfig } from '../gameConfig';
import { MAX_WIN_MULT, NUM_LINES, REELS, ROWS } from '../math/config';
import {
  COIN_TABLE,
  FS_AWARD,
  FS_MAX_MULT,
  FS_RETRIGGER,
  HW_GRAND_MULT,
  HW_RESPINS,
  HW_TRIGGER,
} from '../math/features';
import { PAYLINES } from '../math/paylines';
import { PAYTABLE, type PaySymbol, type SymbolId } from '../math/paytable';
import { symbolKey, UI } from '../scenes/BootScene';
import { fitText } from '../utils/fitText';
import { dimLayer, fadeIn, fadeOut, press } from './fx';
import { formatMoney } from '../utils/format';
import { layout, sd, sx, sy } from '../utils/responsive';

type Page = 'pays' | 'features' | 'lines' | 'rules';
const PAGES: readonly { id: Page; label: string }[] = [
  { id: 'pays', label: 'PAYS' },
  { id: 'features', label: 'FEATURES' },
  { id: 'lines', label: 'LINES' },
  { id: 'rules', label: 'RULES' },
];
/** Highest pay first. */
const PAY_ORDER = (Object.keys(PAYTABLE) as PaySymbol[]).sort(
  (a, b) => PAYTABLE[b][2] - PAYTABLE[a][2],
);
const TOP = 210; // content starts below title + tabs (panel-local, reference px)

/**
 * Paytable / rules modal. Every number comes from src/math (pays, lines, feature rules,
 * jackpots, cap); money is shown at the current bet. Content is rebuilt on open, tab change
 * and relayout only.
 */
export class Paytable {
  private scene: Phaser.Scene;
  private dim: Phaser.GameObjects.Image;
  private chrome: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private closeBtn: Phaser.GameObjects.Image;
  private closeLabel: Phaser.GameObjects.Text;
  private tabs: { img: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; id: Page }[] = [];
  private content: Phaser.GameObjects.Container;
  private page: Page = 'pays';
  private bet = 0;
  private open_ = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const d = DEPTH.MODAL;
    this.dim = dimLayer(scene, 0x000000, 0.72, d).setInteractive(); // swallows taps behind the modal
    this.chrome = scene.add.graphics().setDepth(d);
    this.title = scene.add
      .text(0, 0, 'PAYTABLE', {
        fontFamily: THEME.fonts.ui,
        color: THEME.gold,
        stroke: THEME.stroke,
      })
      .setOrigin(0.5)
      .setDepth(d);
    this.closeBtn = scene.add
      .image(0, 0, UI.round)
      .setDepth(d)
      .setInteractive({ useHandCursor: true });
    this.closeLabel = scene.add
      .text(0, 0, '✕', { fontFamily: THEME.fonts.ui, color: THEME.gold })
      .setOrigin(0.5)
      .setDepth(d);
    this.closeBtn.on('pointerdown', () => {
      press(scene, this.closeBtn, this.closeLabel);
      this.close();
    });
    for (const p of PAGES) {
      const img = scene.add
        .image(0, 0, UI.pillOff)
        .setDepth(d)
        .setInteractive({ useHandCursor: true });
      const label = scene.add
        .text(0, 0, p.label, { fontFamily: THEME.fonts.ui, color: THEME.muted })
        .setOrigin(0.5)
        .setDepth(d);
      img.on('pointerdown', () => {
        this.show(p.id);
        press(scene, img, label);
      });
      this.tabs.push({ img, label, id: p.id });
    }
    this.content = scene.add.container(0, 0).setDepth(d);
    scene.input.keyboard?.on('keydown-ESC', () => this.close());
    this.setVisible(false);
  }

  get isOpen() {
    return this.open_;
  }

  /** bet: current total bet, so pays read as money for this stake. */
  open(bet: number) {
    this.bet = bet;
    this.open_ = true;
    this.fade(true);
    this.show('pays');
  }

  close() {
    if (!this.open_) return;
    this.open_ = false;
    this.fade(false); // content is rebuilt on the next open
  }

  relayout() {
    if (this.open_) this.show(this.page);
  }

  private parts(): (
    | Phaser.GameObjects.Image
    | Phaser.GameObjects.Text
    | Phaser.GameObjects.Graphics
    | Phaser.GameObjects.Container
  )[] {
    const tabs = this.tabs.flatMap((t) => [t.img, t.label]);
    return [this.chrome, this.title, this.closeBtn, this.closeLabel, ...tabs, this.content];
  }

  private fade(on: boolean) {
    if (on) fadeIn(this.scene, this.dim, 0.72);
    else fadeOut(this.scene, this.dim);
    for (const p of this.parts()) (on ? fadeIn : fadeOut)(this.scene, p);
  }

  private setVisible(on: boolean) {
    this.dim.setVisible(on);
    this.chrome.setVisible(on);
    this.title.setVisible(on);
    this.closeBtn.setVisible(on);
    this.closeLabel.setVisible(on);
    for (const t of this.tabs) {
      t.img.setVisible(on);
      t.label.setVisible(on);
    }
    this.content.setVisible(on);
  }

  private show(page: Page) {
    this.page = page;
    const m = this.m();
    this.dim.setDisplaySize(this.scene.scale.width, this.scene.scale.height);
    this.chrome
      .clear()
      .fillStyle(THEME.panel, 0.98)
      .fillRoundedRect(sx(m.x), sy(m.y), sd(m.w), sd(m.h), sd(36))
      .lineStyle(sd(4), THEME.frame, 1)
      .strokeRoundedRect(sx(m.x), sy(m.y), sd(m.w), sd(m.h), sd(36));
    this.title
      .setPosition(this.X(m.w / 2), this.Y(66))
      .setFontSize(Math.round(sd(54)))
      .setStroke(THEME.stroke, sd(8));
    this.closeBtn.setPosition(this.X(m.w - 70), this.Y(66)).setDisplaySize(sd(76), sd(76));
    this.closeLabel.setPosition(this.X(m.w - 70), this.Y(64)).setFontSize(Math.round(sd(36)));

    const tw = m.tab.w;
    const gap = 16;
    const x0 = (m.w - (PAGES.length * tw + (PAGES.length - 1) * gap)) / 2 + tw / 2;
    this.tabs.forEach((t, i) => {
      const on = t.id === page;
      t.img
        .setTint(on ? 0xffdf80 : 0xb0b0c8)
        .setPosition(this.X(x0 + i * (tw + gap)), this.Y(146))
        .setDisplaySize(
          sd(Math.min(tw, (m.tab.h * 512) / 192)),
          sd(Math.min(m.tab.h, (tw * 192) / 512)),
        );
      t.label
        .setPosition(this.X(x0 + i * (tw + gap)), this.Y(145))
        .setFontSize(Math.round(sd(26)))
        .setColor(on ? THEME.gold : THEME.muted);
    });

    this.content.removeAll(true);
    if (page === 'pays') this.pays();
    else if (page === 'features') this.features();
    else if (page === 'lines') this.lines();
    else this.rules();
  }

  // ---- pages ----

  private pays() {
    const m = this.m();
    const lineBet = this.bet / NUM_LINES;
    const cols = m.payCols;
    const rows = Math.ceil(PAY_ORDER.length / cols);
    const pad = 50;
    const cw = (m.w - pad * 2) / cols;
    const ch = Math.min((m.h - TOP - 110) / rows, 300);
    PAY_ORDER.forEach((id, i) => {
      const cx = pad + (i % cols) * cw + cw / 2;
      const cy = TOP + 20 + Math.floor(i / cols) * ch + ch / 2;
      const size = Math.min(ch * 0.62, cw * 0.4, 150);
      this.image(id, cx - cw * 0.2, cy, size);
      const pays = PAYTABLE[id];
      for (let k = 0; k < 3; k++) {
        const count = 5 - k;
        const y = cy + (k - 1) * size * 0.36;
        this.text(cx + cw * 0.02, y, `${count}`, 30, THEME.muted, 0);
        this.text(
          cx + cw * 0.1,
          y,
          formatMoney(pays[2 - k] * lineBet),
          32,
          THEME.text,
          0,
          cw * 0.36,
        );
      }
    });
    this.text(
      m.w / 2,
      m.h - 60,
      `Pays for a total bet of ${formatMoney(this.bet)} (line bet ${formatMoney(lineBet)}). ` +
        `WILD substitutes on all lines.`,
      26,
      THEME.muted,
      0.5,
      m.w - 100,
    );
  }

  private features() {
    const m = this.m();
    const bet = this.bet;
    const coins = COIN_TABLE.filter((c) => !c.jackpot).map((c) => c.mult);
    const jackpot = (name: string) => {
      const c = COIN_TABLE.find((e) => e.jackpot === name)!;
      return `${name.toUpperCase()} ${formatMoney(c.mult * bet)}`;
    };
    const blocks: { id: SymbolId; title: string; body: string }[] = [
      {
        id: 'WILD',
        title: 'WILD',
        body: 'Appears on reels 2, 3 and 4. Substitutes for every symbol except SCATTER and COIN.',
      },
      {
        id: 'SCATTER',
        title: 'FREE SPINS',
        body:
          `3, 4 or 5 SCATTER anywhere award ${FS_AWARD[3]}, ${FS_AWARD[4]} or ${FS_AWARD[5]} free spins. ` +
          `The win multiplier starts at x1 and grows by 1 after every winning free spin, up to x${FS_MAX_MULT}. ` +
          `3 or more SCATTER during free spins add ${FS_RETRIGGER} more spins.`,
      },
      {
        id: 'COIN',
        title: 'HOLD & WIN',
        body:
          `${HW_TRIGGER} or more COIN in the base game start Hold & Win with ${HW_RESPINS} respins. ` +
          `Coins lock in place and each new coin resets the respins to ${HW_RESPINS}. ` +
          `Coins are worth ${formatMoney(Math.min(...coins) * bet)} to ${formatMoney(Math.max(...coins) * bet)}, ` +
          `or a jackpot: ${jackpot('mini')}, ${jackpot('minor')}, ${jackpot('major')}. ` +
          `Fill all ${REELS * ROWS} positions for the GRAND ${formatMoney(HW_GRAND_MULT * bet)}. ` +
          `If both features trigger together, Free Spins is awarded.`,
      },
    ];
    const bh = (m.h - TOP - 60) / blocks.length;
    blocks.forEach((b, i) => {
      const cy = TOP + 20 + i * bh + bh / 2;
      const size = Math.min(bh * 0.6, 150);
      this.image(b.id, 60 + size / 2, cy, size);
      const tx = 60 + size + 40;
      this.text(tx, cy - bh * 0.32, b.title, 38, THEME.gold, 0);
      this.text(tx, cy - bh * 0.32 + 34, b.body, 27, THEME.text, 0, m.w - tx - 60).setOrigin(0, 0);
    });
  }

  private lines() {
    const m = this.m();
    const cols = m.lineCols;
    const rows = Math.ceil(PAYLINES.length / cols);
    const pad = 40;
    const cw = (m.w - pad * 2) / cols;
    const ch = (m.h - TOP - 40) / rows;
    const c = Math.min((cw - 24) / REELS, (ch - 46) / ROWS); // mini cell size
    const g = this.scene.add.graphics();
    this.content.add(g);
    PAYLINES.forEach((line, i) => {
      const gx = pad + (i % cols) * cw + (cw - c * REELS) / 2;
      const gy = TOP + Math.floor(i / cols) * ch + 38;
      this.text(gx + (c * REELS) / 2, gy - 18, `${i + 1}`, 22, THEME.muted);
      for (let r = 0; r < REELS; r++) {
        for (let row = 0; row < ROWS; row++) {
          const on = line[r] === row;
          g.fillStyle(on ? 0xffd34d : THEME.reelColumn, 1).fillRect(
            this.X(gx + r * c + 1),
            this.Y(gy + row * c + 1),
            sd(c - 2),
            sd(c - 2),
          );
        }
      }
    });
  }

  private rules() {
    const m = this.m();
    const body = [
      `${NUM_LINES} fixed paylines. Wins pay left to right on adjacent reels, starting from the leftmost reel. ` +
        'Only the highest win per line is paid; wins on different lines are added together.',
      `Maximum win is ${MAX_WIN_MULT.toLocaleString('en-US')}x the total bet per round. When it is reached, ` +
        'the round ends immediately and any remaining feature play is forfeited.',
      'TURBO speeds up the reels only; results and payouts are the same.',
      'Interrupted rounds are restored and finished automatically when the game is reopened.',
      `Theoretical return to player (RTP): ${gameConfig.rtpLabel}.`,
      'Malfunction voids all pays and plays.',
    ].join('\n\n');
    this.text(70, TOP + 20, body, 30, THEME.text, 0, m.w - 140)
      .setOrigin(0, 0)
      .setLineSpacing(sd(6));
  }

  // ---- helpers (panel-local reference coordinates) ----

  private m() {
    return layout.landscape ? MODAL_LAYOUT.landscape : MODAL_LAYOUT.portrait;
  }

  private X(x: number) {
    return sx(this.m().x + x);
  }

  private Y(y: number) {
    return sy(this.m().y + y);
  }

  private image(id: SymbolId, x: number, y: number, size: number) {
    const img = this.scene.add
      .image(this.X(x), this.Y(y), symbolKey(id))
      .setDisplaySize(sd(size), sd(size));
    this.content.add(img);
    return img;
  }

  /** originX 0 = left aligned, 0.5 = centered. wrap > 0 wraps (or for single tokens, shrinks) to that width. */
  private text(
    x: number,
    y: number,
    s: string,
    size: number,
    color: string,
    originX = 0.5,
    wrap = 0,
  ) {
    const t = this.scene.add
      .text(this.X(x), this.Y(y), s, { fontFamily: THEME.fonts.ui, color, fontStyle: 'bold' })
      .setOrigin(originX, 0.5)
      .setFontSize(Math.round(sd(size)));
    if (wrap > 0) {
      if (s.includes(' ')) t.setWordWrapWidth(sd(wrap), true);
      else fitText(t, sd(size), sd(wrap));
    }
    this.content.add(t);
    return t;
  }
}
