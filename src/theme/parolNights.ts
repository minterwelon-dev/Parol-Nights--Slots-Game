import type { SymbolId } from '../rgs/types';

// Vite emits hashed, relative URLs. A missing source stays undefined and uses the fallback.
const files = import.meta.glob(
  [
    '../../Assets/theme/parol-nights/{runtime/**/*.webp,frame/*.webp,ui/*.webp,icons/*.webp,parts/*.webp}',
    '!../../Assets/theme/parol-nights/parts/H3_outer.webp',
  ],
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>;
const asset = (key: string, file: string) => ({
  key,
  file,
  url: files[`../../Assets/theme/parol-nights/${file}`],
});
export const symbolKey = (id: SymbolId) => `sym_${id}`;
export const blurKey = (id: SymbolId) => `sym_${id}_blur`;
export const SYMBOL_IDS: readonly SymbolId[] = [
  'L1',
  'L2',
  'L3',
  'L4',
  'H1',
  'H2',
  'H3',
  'WILD',
  'SCATTER',
  'COIN',
];
export const SYMBOLS = Object.fromEntries(
  SYMBOL_IDS.map((id) => [id, asset(symbolKey(id), `runtime/symbols/${id}.webp`)]),
) as Record<SymbolId, ReturnType<typeof asset>>;
export const ART = {
  landscape: asset('bg_landscape', 'runtime/bg/bg_landscape.webp'),
  portrait: asset('bg_portrait', 'runtime/bg/bg_portrait.webp'),
  frame: asset('reel_frame', 'frame/reel_frame.webp'),
  spin: asset('ui_spin', 'ui/spin_button.webp'),
  spinArrow: asset('ui_spin_arrow', 'ui/spin_arrows.webp'),
  spinStar: asset('ui_spin_star', 'ui/spin_star.webp'),
  stop: asset('ui_stop', 'ui/stop_icon.webp'),
  round: asset('ui_round', 'ui/button_round.webp'),
  plaque: asset('ui_btn', 'ui/button_plaque.webp'),
  logo: asset('logo-ornament', 'ui/logo_ornament.webp'),
};
// Noche Buena dishes: the Free Spins feast table (FeastTable.ts) fills with these. Deferred.
export const FOOD = [
  'queso_de_bola',
  'hamon',
  'sweet_spaghetti',
  'fruit_salad',
  'bibingka',
  'puto_bumbong',
].map((id) => asset(`food_${id}`, `icons/${id}.webp`));
export interface SymbolPart {
  name: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  originY?: number;
}
// Attachment coordinates are measured on the exported 512px canvases, scaled with the cell.
const tassels = (
  name: string,
  points: readonly (readonly [number, number])[],
  width: number,
): SymbolPart[] =>
  points.map(([x, y]) => ({
    name,
    x,
    y,
    width,
    height: width * 2,
    originY: name === 'H2_tassel' ? 0.08 : 0.325,
  }));
export const SYMBOL_PARTS: Partial<Record<SymbolId, readonly SymbolPart[]>> = {
  H3: [
    { name: 'H3_inner' },
    { name: 'H3_outer_body' },
    { name: 'H3_core' },
    ...tassels(
      'tassel',
      [
        [88, 181],
        [425, 181],
        [146, 357],
        [365, 357],
      ],
      96,
    ),
  ],
  WILD: [{ name: 'WILD_rays' }, { name: 'WILD_core' }],
  L1: [
    { name: 'L1_body' },
    ...tassels(
      'tassel',
      [
        [66, 185],
        [445, 185],
        [133, 383],
        [380, 383],
      ],
      48,
    ),
    ...tassels('tassel', [[256, 56]], 24),
  ],
  L2: [{ name: 'L2_body' }, ...tassels('tassel', [[256, 386]], 60)],
  L3: [{ name: 'L3_body' }, ...tassels('tassel', [[256, 388]], 60)],
  L4: [
    { name: 'L4_body' },
    ...tassels(
      'tassel',
      [
        [78, 237],
        [434, 237],
        [130, 113],
        [381, 113],
        [130, 359],
        [381, 359],
        [256, 404],
      ],
      48,
    ),
    ...tassels('tassel', [[256, 50]], 24),
  ],
  H1: [
    { name: 'H1_body' },
    ...tassels(
      'tassel',
      [
        [92, 170],
        [420, 170],
        [152, 341],
        [362, 341],
      ],
      96,
    ),
    ...tassels('tassel', [[256, 58]], 32),
  ],
  H2: [
    { name: 'H2_body' },
    ...tassels(
      'H2_tassel',
      [
        [104, 164],
        [406, 164],
        [118, 317],
        [393, 317],
        [256, 375],
      ],
      48,
    ),
  ],
  SCATTER: [
    { name: 'pandereta_hoop' },
    ...[-90, -135, -180, -215, -45, 0, 35].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return {
        name: 'pandereta_cap',
        x: 256 + 151 * Math.cos(a),
        y: 211 + 151 * Math.sin(a),
        width: 88,
        height: 88,
        originY: 0.125,
      };
    }),
  ],
};
export const MAX_SYMBOL_PARTS = Math.max(
  ...Object.values(SYMBOL_PARTS).map((parts) => parts.length),
);
export const partKey = (name: string) => `part_${name}`;
const PARTS = [
  ...new Set(
    Object.values(SYMBOL_PARTS)
      .flat()
      .map((part) => part.name),
  ),
].map((name) => asset(partKey(name), `parts/${name}.webp`));
export const UI = {
  px: 'ui_px',
  spin: ART.spin.key,
  spinArrow: ART.spinArrow.key,
  spinStar: ART.spinStar.key,
  stop: ART.stop.key,
  round: ART.round.key,
  coin: symbolKey('COIN'),
  glow: 'ui_glow',
  rays: 'ui_rays',
  cellFrame: 'ui_cell_frame',
  pillOff: ART.plaque.key,
  soundOn: 'ui_sound_on',
  soundOff: 'ui_sound_off',
  motionOn: 'ui_motion_on',
  motionOff: 'ui_motion_off',
  btn: ART.plaque.key,
  panel: 'ui_panel',
} as const;
export const criticalArt = (landscape: boolean) => [
  ...Object.values(SYMBOLS),
  landscape ? ART.landscape : ART.portrait,
  ART.frame,
  ART.logo,
  ART.spin,
  ART.spinArrow,
  ART.spinStar,
  ART.stop,
  ART.round,
  ART.plaque,
];
export const deferredArt = (landscape: boolean) => [
  landscape ? ART.portrait : ART.landscape,
  ...FOOD,
  ...PARTS,
];
const warned = new Set<string>();
export function warnMissing(key: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[art] ${key} unavailable; using procedural fallback`);
}
