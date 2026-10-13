import type { SymbolId } from '../rgs/types';

// Vite emits hashed, relative URLs. A missing source stays undefined and uses the fallback.
const files = import.meta.glob('../../Assets/theme/parol-nights/{runtime/**/*.webp,frame/*.webp,ui/*.webp,icons/*.webp}', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
const asset = (key: string, file: string) => ({ key, file, url: files[`../../Assets/theme/parol-nights/${file}`] });
export const symbolKey = (id: SymbolId) => `sym_${id}`;
export const blurKey = (id: SymbolId) => `sym_${id}_blur`;
export const SYMBOL_IDS: readonly SymbolId[] = ['L1', 'L2', 'L3', 'L4', 'H1', 'H2', 'H3', 'WILD', 'SCATTER', 'COIN'];
export const SYMBOLS = Object.fromEntries(SYMBOL_IDS.map(id => [id, asset(symbolKey(id), `runtime/symbols/${id}.webp`)])) as Record<SymbolId, ReturnType<typeof asset>>;
export const ART = {
  landscape: asset('bg_landscape', 'runtime/bg/bg_landscape.webp'),
  portrait: asset('bg_portrait', 'runtime/bg/bg_portrait.webp'),
  frame: asset('reel_frame', 'frame/reel_frame.webp'),
  spin: asset('ui_spin', 'ui/spin_button.webp'),
  round: asset('ui_round', 'ui/button_round.webp'),
  plaque: asset('ui_btn', 'ui/button_plaque.webp'),
  logo: asset('logo-ornament', 'ui/logo_ornament.webp'),
};
export const UI = {
  px: 'ui_px', spin: ART.spin.key, spinArrow: 'ui_spin_arrow', stop: 'ui_stop',
  round: ART.round.key, coin: symbolKey('COIN'), glow: 'ui_glow', rays: 'ui_rays',
  cellFrame: 'ui_cell_frame', pillOff: ART.plaque.key, soundOn: 'ui_sound_on',
  soundOff: 'ui_sound_off', btn: ART.plaque.key, panel: 'ui_panel',
} as const;
export const criticalArt = (landscape: boolean) => [
  ...Object.values(SYMBOLS), landscape ? ART.landscape : ART.portrait,
  ART.frame, ART.logo, ART.spin, ART.round, ART.plaque,
];
export const deferredArt = (landscape: boolean) => [landscape ? ART.portrait : ART.landscape];
const warned = new Set<string>();
export function warnMissing(key: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[art] ${key} unavailable; using procedural fallback`);
}
