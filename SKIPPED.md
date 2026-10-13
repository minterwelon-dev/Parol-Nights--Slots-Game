# Skipped Work — Parol Nights

Everything from `PROJECT_BRIEF.md` and the `AGENTS.md` Ship Checklist that was deliberately left out, with what it would take to add it.
Keep this list current: remove an entry when it gets done.

_Last updated: 2026-10-13_

## Phase 4 — optional stretch

| Item | Status | What it would take |
|---|---|---|
| Spine animation on one symbol | Skipped | Add `@esotericsoftware/spine-phaser`, load one skeleton in the deferred manifest, swap it in for that symbol's win animation in `Symbol.ts`. The module APIs don't change (`AGENTS.md`: swapping in real art must not change module APIs). |
| Session clock / reality check overlay | Skipped | Session start time in `GameScene`, a clock in the HUD header, and a modal every N minutes (interval in `gameConfig`) that blocks spins until the player acknowledges it. The modal opens only from `Idle`. |

## Phase 5 — delivery

| Item | Status | What it would take |
|---|---|---|
| Deployed demo (GitHub Pages) | In progress | `.github/workflows/pages.yml` builds, runs the self-checks and the debug-code gate, and publishes `dist/` on pushes to `main`. Needs the public GitHub repo URL, a push, and Pages set to "GitHub Actions" in the repo settings. Then add the link to the README and tick the Ship Checklist. |

The gameplay video is done: `docs/media/gameplay.mp4`.

## Ship Checklist items left open

- **Live demo link** in the README: needs the first Pages deploy.

## Smaller gaps (not separate brief items)

| Gap | Notes |
|---|---|
| No separate settings modal | Phase 4 asked for a "settings and paytable modal". The paytable modal exists. The settings (mute, turbo) are HUD toggles, so no settings modal was built. |
| Placeholder audio | Symbols, backgrounds and UI now use the generated Parol Nights art (procedural fallbacks remain for load failures). The 8 SFX are still ffmpeg-synthesized placeholders. Final art is a brief non-goal; `Assets/audio/SOUND_MAP.txt` says how to swap the audio. |
| Phaser chunk not split | The single JS chunk is ~1.33 MB raw / ~364 KB gzip, almost all Phaser. Vite warns about the chunk size. Splitting it with `manualChunks` would help caching only, not the first load. |
