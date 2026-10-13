// DEV ONLY. Mounted from main.ts behind import.meta.env.DEV; never part of a production build.
// Plain DOM on purpose: native select / range / number inputs, and clicks never reach the canvas.
import type Phaser from 'phaser';
import { FORCES, forcePicker, type Force } from '../rgs/force';
import type { MockRGS } from '../rgs/MockRGS';
import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '../utils/storage';

const RESET_KEYS = [
  STORAGE_KEYS.rgs,
  STORAGE_KEYS.progress,
  LEGACY_STORAGE_KEYS.rgs,
  LEGACY_STORAGE_KEYS.progress,
];

const CSS = `
#dbg { position: fixed; bottom: 8px; left: 8px; z-index: 1000; width: 240px;
  font: 12px/1.4 var(--font-ui); color: #f3e6d8; background: rgba(20, 10, 6, 0.92);
  border: 1px solid #8a5222; border-radius: 8px; padding: 6px 10px; user-select: none; }
#dbg summary { cursor: pointer; font-weight: 700; color: #ffd34d; letter-spacing: 0.08em; }
#dbg label { display: block; margin-top: 8px; color: #b8916c; }
#dbg .row { display: flex; gap: 6px; align-items: center; margin-top: 3px; }
#dbg select, #dbg input[type=number] { flex: 1; min-width: 0; background: #1f0e09; color: #f3e6d8;
  border: 1px solid #6e3f1a; border-radius: 4px; padding: 3px; }
#dbg input[type=range] { flex: 1; accent-color: #ffd34d; }
#dbg button { background: #3a1d12; color: #ffd34d; border: 1px solid #d9861a; border-radius: 4px;
  padding: 3px 8px; cursor: pointer; }
#dbg .v { min-width: 52px; text-align: right; color: #f3e6d8; font-variant-numeric: tabular-nums; }
#dbg .armed { color: #8bff6b; }
#dbg hr { border: 0; border-top: 1px solid #4a2a14; margin: 8px 0 4px; }
`;

/** Force outcome, session seed, latency, failure rate, reset, FPS. */
export function mountDebugPanel(rgs: MockRGS, game: Phaser.Game) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('details');
  root.id = 'dbg';
  root.innerHTML = `
    <summary>DEBUG</summary>
    <label>Force next round</label>
    <div class="row">
      <select data-k="force">${FORCES.map((f) => `<option>${f}</option>`).join('')}</select>
      <button data-k="arm">Arm</button>
    </div>
    <div class="row"><span data-k="armed" class="armed"></span></div>
    <label>Session seed</label>
    <div class="row">
      <input data-k="seed" type="number" min="0" step="1">
      <button data-k="setSeed">Set</button>
    </div>
    <div class="row"><span data-k="seedInfo"></span></div>
    <label>Latency (max ms)</label>
    <div class="row"><input data-k="lat" type="range" min="0" max="3000" step="50"><span data-k="latV" class="v"></span></div>
    <label>Failure rate</label>
    <div class="row"><input data-k="fail" type="range" min="0" max="1" step="0.05"><span data-k="failV" class="v"></span></div>
    <hr>
    <div class="row">
      <button data-k="reset">Reset session</button>
      <span data-k="fps" class="v" style="flex:1"></span>
    </div>`;
  document.body.appendChild(root);

  const $ = <T extends HTMLElement>(k: string) => root.querySelector(`[data-k="${k}"]`) as T;
  const force = $<HTMLSelectElement>('force');
  const armed = $('armed');
  const seed = $<HTMLInputElement>('seed');
  const lat = $<HTMLInputElement>('lat');
  const fail = $<HTMLInputElement>('fail');
  let armedName: Force | null = null;

  $('arm').onclick = () => {
    armedName = force.value as Force;
    rgs.pick = forcePicker(armedName); // one-shot: MockRGS clears it after the next spin
  };
  $('setSeed').onclick = () => {
    const n = Number(seed.value);
    if (Number.isInteger(n) && n >= 0) rgs.setSeed(n);
  };
  seed.value = String(rgs.seed);

  // latency slider sets the max; min is a third of it so calls still vary
  lat.value = String(rgs.latency[1]);
  lat.oninput = () => {
    const max = Number(lat.value);
    rgs.latency = [Math.round(max / 3), max];
  };
  fail.value = String(rgs.failureRate);
  fail.oninput = () => (rgs.failureRate = Number(fail.value));

  $('reset').onclick = () => {
    for (const k of RESET_KEYS) localStorage.removeItem(k);
    location.reload();
  };

  const tick = () => {
    if (armedName && !rgs.pick) armedName = null; // consumed by a spin
    armed.textContent = armedName ? `armed: ${armedName}` : '';
    $('seedInfo').textContent = `seed ${rgs.seed} · rounds ${rgs.nonce}`;
    $('latV').textContent = `${rgs.latency[1]} ms`;
    $('failV').textContent = `${Math.round(rgs.failureRate * 100)}%`;
    $('fps').textContent = `${Math.round(game.loop.actualFps)} fps`;
  };
  tick();
  setInterval(tick, 500);
}
