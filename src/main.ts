import Phaser from 'phaser';
import { RELAYOUT } from './constants';
import { GAME_TITLE, gameConfig } from './gameConfig';
import { MockRGS } from './rgs/MockRGS';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { updateLayout } from './utils/responsive';
import { migrateStorage } from './utils/storage';
import { loadFonts, refreshFonts } from './utils/fonts';

// current viewport in CSS px; module-level so the per-frame poll allocates nothing
let vw = 0;
let vh = 0;
let dpr = 1;

/** Read the viewport; true if it changed since last read. */
function readViewport(): boolean {
  const vv = window.visualViewport;
  const w = Math.round(vv ? vv.width : window.innerWidth);
  const h = Math.round(vv ? vv.height : window.innerHeight);
  const d = window.devicePixelRatio || 1;
  if (w === vw && h === vh && d === dpr) return false;
  vw = w;
  vh = h;
  dpr = d;
  return true;
}

/** Canvas = viewport x DPR internally, viewport px in CSS (zoom 1/dpr). */
function bindResponsiveResize(game: Phaser.Game) {
  const apply = () => {
    if (!readViewport()) return;
    game.scale.setZoom(1 / dpr);
    game.scale.resize(vw * dpr, vh * dpr);
    game.events.emit(RELAYOUT, updateLayout(vw * dpr, vh * dpr));
  };
  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
    // iOS reports the final size late after rotation
    setTimeout(apply, 100);
    setTimeout(apply, 300);
    setTimeout(apply, 600);
  };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  game.events.on(Phaser.Core.Events.PRE_STEP, apply); // per-frame poll catches missed rotations
}

function start() {
  document.title = GAME_TITLE;
  migrateStorage();
  const parent = document.createElement('div');
  parent.id = 'game';
  document.body.appendChild(parent);

  readViewport();
  updateLayout(vw * dpr, vh * dpr);

  const rgs = new MockRGS({
    latency: gameConfig.rgs.latency,
    failureRate: gameConfig.rgs.failureRate,
    startBalance: gameConfig.startBalance,
  });
  // dev console / automation hook, e.g. __rgs.pick = (await import('/src/rgs/force.ts')).forcePicker('bigWin')
  if (import.meta.env.DEV) Object.assign(window, { __rgs: rgs });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    transparent: true,
    parent,
    scale: { mode: Phaser.Scale.NONE, width: vw * dpr, height: vh * dpr, zoom: 1 / dpr },
    render: { antialias: true, pixelArt: false },
    scene: [new BootScene(), new GameScene(rgs)],
  });
  bindResponsiveResize(game);
  const refresh = () => {
    const boot = game.scene.getScene('Boot') as BootScene | null;
    if (boot?.textures.exists('sym_L1')) boot.refreshSymbolTextures();
    refreshFonts(game);
  };
  document.fonts.addEventListener('loadingdone', refresh);
  game.events.once(Phaser.Core.Events.DESTROY, () =>
    document.fonts.removeEventListener('loadingdone', refresh),
  );
  if (import.meta.env.DEV) {
    Object.assign(window, { __game: game });
    // dynamic import inside the DEV branch: Vite drops the panel (and force.ts) from prod builds
    void import('./game/DebugPanel').then((m) => m.mountDebugPanel(rgs, game));
  }
}

function prepare() {
  const fonts = loadFonts();
  void Promise.race([fonts, new Promise<void>((resolve) => setTimeout(resolve, 1500))]).then(start);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepare);
else prepare();
