# Parol Nights — Phaser 3 Slot Sample (Project Brief)

Working title: **Parol Nights**. Rename freely.

## 1. Purpose

A portfolio sample that mirrors how a regulated-market slot studio structures a **client-side** HTML5 slot: a dumb renderer driven by a server-authoritative result, a strict state machine, hold-and-win and free-spins features, and certification-friendly tooling (seeded replay, forced outcomes, RTP simulation).

Target role it supports: mid-to-senior Slot Game Developer (JavaScript, HTML5, Phaser 3).

Read `AGENTS.md` first. It holds the conventions, structure and rules. This file holds the **what** and the **order of work**.

### Goals
- Show correct slot architecture: client renders, a (mock) RGS decides.
- Ship two real features: **Free Spins with growing multiplier** and **Hold & Win (Link-style respins)**.
- Be demonstrably performant on mid-range mobile and usable on desktop.
- Be easy for a reviewer to run, read and verify (README, simulation output, demo video).

### Non-goals
- Real money, real RGS integration, real certification.
- Final art. Use generated placeholder graphics (Phaser `Graphics` / `generateTexture`). Spine is an optional stretch.
- Social features, jackpots networks, bonus buy.

## 2. Game spec

### Grid and lines
- 5 reels x 3 rows, **40 fixed paylines**, left-to-right, 3+ matching symbols from reel 1.
- Line patterns live in `src/math/paylines.ts` (40 distinct patterns, defined once, used by both the math and the line-win renderer).
- Bet = total bet (integer minor units). Line bet = total bet / 40.

### Symbols
| ID | Role | Notes |
|---|---|---|
| `L1`–`L4` | Low pay | Four low symbols |
| `H1`–`H3` | High pay | Three high symbols |
| `WILD` | Substitutes for L/H | Reels 2, 3, 4 only. Does not substitute for SCATTER or COIN |
| `SCATTER` | Free spins trigger | Any reel, 3+ anywhere triggers |
| `COIN` | Hold & Win trigger | Any reel, 6+ anywhere (base game only) triggers. Carries a value |

### Starting paytable (multiples of line bet)
Starting values only. Tune with the simulation script to land near a **95–96% RTP** target.

| Symbol | 3 | 4 | 5 |
|---|---|---|---|
| L1 | 1 | 3 | 8 |
| L2 | 1 | 3 | 8 |
| L3 | 2 | 5 | 12 |
| L4 | 2 | 5 | 12 |
| H1 | 4 | 10 | 30 |
| H2 | 5 | 15 | 40 |
| H3 | 8 | 25 | 100 |

### Free Spins
- Trigger: 3+ SCATTER. Awards 10 spins (4 SCATTER = 12, 5 = 15).
- Multiplier starts at x1 and increases by +1 after each winning spin, capped at x15. It applies to all line wins.
- Retrigger: 3+ SCATTER during free spins adds 5 spins.
- Uses its own reel strips (more WILD, no COIN).

### Hold & Win
- Trigger: 6+ COIN visible after a base-game spin.
- COIN symbols lock in place. Each COIN has a value (multiple of total bet) from a weighted table, plus rare jackpot coins: Mini 20x, Minor 50x, Major 200x.
- 3 respins. Landing any new COIN resets respins to 3.
- Round ends when respins reach 0 or all 15 positions are filled. Filling all 15 awards Grand 1000x on top.
- Total payout = sum of all coin values (+ Grand if full).

### Global rules
- **Max win cap: 5000x total bet.** Round ends immediately when reached, remaining features are skipped.
- All money is **integer minor units**. Format only at render time.
- Win tiers for presentation: normal, big (>=15x), mega (>=50x), epic (>=100x).
- Turbo mode and tap-to-skip on every presentation.

## 3. Architecture summary

Full rules live in `AGENTS.md`. Short version:

```
src/math/        pure TS, zero Phaser imports -> shared by MockRGS and scripts/simulate.ts
src/rgs/         RGS interface + MockRGS (latency, errors, seeded RNG, forced outcomes)
src/game/        single-responsibility Phaser modules (Reels, WinLines, HoldAndWin, FreeSpins, Hud...)
src/state/       SlotStateMachine (single source of truth for round flow)
src/scenes/      BootScene, GameScene (orchestrator only)
scripts/         simulate.ts (RTP/hit-frequency), build helpers
```

Round flow (state machine):

```
Idle -> Spinning -> Stopping -> Evaluating -> WinPresentation
     -> (FreeSpins | HoldAndWin) -> Idle
```

## 4. RGS contract (mock)

The client sends a bet, the RGS returns the **entire round** (base spin + any feature outcomes). The client plays it back and never recomputes outcomes.

```ts
interface SpinRequest  { sessionId: string; bet: number; }            // bet in minor units
interface SpinResponse {
  roundId: string;
  balance: number;                  // after the round
  stops: number[];                  // reel stop positions
  grid: SymbolId[][];               // [reel][row]
  lineWins: { line: number; symbol: SymbolId; count: number; win: number }[];
  baseWin: number;
  feature?: FreeSpinsRound | HoldAndWinRound;
  totalWin: number;                 // includes feature, capped at 5000x bet
  capped: boolean;
}
```

Mock behaviours required: injectable latency, injectable failure rate, seeded RNG (replay any spin from a seed), forced outcomes (dev only), and resume of an unfinished round after refresh (state persisted in `localStorage`).

## 5. Phases

Tick items as they are completed.

### Phase 0 — Setup (0.5 day)
- [x] Vite + TypeScript + Phaser 3.90, ESLint, Prettier
- [x] Folder structure from `AGENTS.md`
- [x] Responsive layout helpers (`sx`, `sy`, `sd`) with landscape and portrait references
- [x] CI-less sanity: `npm run dev`, `npm run build`, `npm run simulate` all run

### Phase 1 — Math and mock RGS (2 days)
- [x] `paylines.ts`, `paytable.ts`, `reelStrips.ts`, `rng.ts` (seedable)
- [x] Spin evaluation: line wins with wild substitution
- [x] Free spins and hold-and-win outcome generation
- [x] Max win cap
- [x] `MockRGS` implementing the contract (latency, failure, resume)
- [x] `scripts/simulate.ts`: 1M spins, prints RTP, hit frequency, feature frequency, max win, breakdown by source (base / FS / H&W)
- [x] Tune strips and paytable to land at ~95–96% RTP

### Phase 2 — Core reels and UI (3–4 days)
- [x] State machine wired and logging transitions in dev
- [x] Masked reels, pooled symbols, strip-based spin, staggered stops with bounce
- [x] Anticipation on near-miss SCATTER / COIN
- [x] Line-win highlight, win count-up, win tiers
- [x] HUD: balance, bet selector, win meter, spin, turbo
- [x] Tap-to-skip on win presentation
- [x] Portrait and landscape layouts

### Phase 3 — Features (4–5 days)
- [x] Free Spins: intro, counter, growing multiplier, retrigger, summary
- [x] Hold & Win: intro, locked coins, respin counter reset, value reveal, jackpot coins, full-grid Grand, summary
- [x] Feature transitions are skippable and survive the max win cap

### Phase 4 — Platform concerns (3 days)
- [x] Loading screen, critical vs deferred asset loading
- [x] Audio: gated on first `pointerdown`, mute toggle, suspend when tab hidden
- [x] Error handling: dropped request, retry, resume interrupted round
- [x] Debug panel (dev only): force outcome, set seed, latency, failure rate
- [x] Settings and paytable modal (paytable generated from `paytable.ts`, not hand-typed)
- [ ] Optional stretch: Spine animation on one symbol, session clock / reality check overlay _(skipped, see SKIPPED.md)_

### Phase 5 — Polish and delivery (2 days)
- [x] FPS check under CPU throttle (mobile profile)
- [x] Bundle size reported (raw and gzip)
- [x] README with architecture diagram, state machine, RGS contract, how to run the simulation
- [x] Deployed demo (GitHub Pages or Netlify): https://minterwelon-dev.github.io/Parol-Nights--Slots-Game/
- [x] 30–60 second gameplay video showing base game, free spins, hold & win, debug panel forcing a feature (`docs/media/gameplay.mp4`, 39 s)

## 6. Acceptance criteria

- `npm run simulate -- --spins 1000000 --seed 42` prints RTP within 94.5–96.5% and is reproducible for the same seed.
- Replaying a recorded seed through `MockRGS` produces a bit-identical `SpinResponse`.
- The client contains **no win evaluation logic**. Win amounts displayed always come from the response. Dev builds assert that the displayed total equals `totalWin`.
- No Phaser import exists under `src/math/` or `scripts/`.
- Stable 60 FPS on desktop and >= 55 FPS under 4x CPU throttle in a mobile viewport.
- Refreshing mid-feature resumes the round correctly.
- Production build contains no debug panel or forced-outcome code.
- Portrait and landscape both usable, no layout breakage on resize or rotation.

## 7. Deliverables

1. Source repo with README
2. Live demo link
3. Simulation output (committed as `docs/simulation-report.txt`)
4. Short gameplay video
5. One-page architecture note (can be the README section)

## 8. Kickoff prompt (paste into Claude Code)

> Read `AGENTS.md` and `PROJECT_BRIEF.md`. Start with Phase 0 and Phase 1. Do not touch Phaser until `npm run simulate` works and the math module has zero Phaser imports. Ask me before changing the game spec.
