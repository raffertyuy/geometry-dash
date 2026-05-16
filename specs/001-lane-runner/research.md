# Research: Lane Runner Core Movement (Phase 0)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

The spec had no remaining `[NEEDS CLARIFICATION]` markers, so this research focuses on the tech-stack decisions and the platform gotchas the user (a first-time game developer) should know about. Each decision section follows: **Decision** / **Rationale** / **Alternatives considered**.

---

## Tech-stack decisions

### Why Phaser 3, not vanilla canvas

- **Decision**: Use Phaser 3 (latest stable, ^3.85) as the runtime game framework.
- **Rationale**:
  - Phaser handles a real set of "you didn't know you needed this" platform issues by default - delta-time-correct game loop, multi-input normalisation (keyboard + touch + pointer), iOS audio unlock, scale management across 320 px - 4K screens, tab-visibility pausing. Coming in to game dev for the first time, surfacing these by *not* tripping on them is worth the framework cost.
  - Bundle size: ~670 KB minified, ~220 KB gzipped. Fits the constitution's 500 KB gzipped critical-JS budget with headroom for our own ~30 KB of code.
  - Mature scene management makes the future shape of the game (Boot → Start → Run → Question Modal → GameOver) trivial to add later.
  - Active community (community-built Phaser endless runners can be cribbed for patterns).
- **Alternatives considered**:
  - **Vanilla TypeScript + Canvas 2D.** Smaller (~30 KB total), zero framework lock-in, fully aligned with Constitution Principle I. Rejected because the user explicitly weighed safety-net value over minimal bundle, and Phaser fits the perf budget.
  - **Phaser 2.** Legacy; no advantage over 3.x.
  - **PixiJS + custom game loop.** Pixi gives renderer only; you'd write input/scene/scale yourself. Worst of both worlds for this game.
  - **Three.js / Babylon.** 3D engines; overkill for a 2D lane runner.

### Why Vite (not Webpack, esbuild-direct, or no-build)

- **Decision**: Vite ^6 as both dev server and production bundler.
- **Rationale**:
  - Sub-second HMR makes the dev loop tight - change a Scene file, see it in the browser in <500 ms.
  - First-class TypeScript support out of the box (no `ts-loader` ceremony).
  - Trivial production build (`vite build` produces hashed assets + minified JS).
  - Plays well with Vitest (`vitest` reuses Vite's transform pipeline, so test setup is one config file shorter).
  - Cloudflare Pages and other hosts auto-detect Vite projects.
- **Alternatives considered**:
  - **Webpack 5.** More configurable, slower dev loop, more config to maintain.
  - **esbuild directly.** Very fast, but you have to wire HMR + dev server yourself.
  - **No build (TS via tsc + plain HTML).** Forces you to ship ES modules with bare-relative imports and lose tree-shaking. Possible, but the constitution's "static web app" goal doesn't require it, and it gives up Vite's developer-experience wins.

### Why Vitest (not Jest or the Node test runner)

- **Decision**: Vitest ^2 for unit and integration tests.
- **Rationale**:
  - Reuses Vite's TS transform - no separate compile step or `ts-jest` config.
  - Fast: parallel by default, watch mode is instant.
  - Vitest's API is Jest-compatible (`describe`/`it`/`expect`), so any Jest experience transfers and most Jest answers on Stack Overflow apply.
  - Built-in coverage reporting via V8.
- **Alternatives considered**:
  - **Jest.** Requires `ts-jest` or `@swc/jest` to compile TS; slower; works fine but adds config.
  - **Node native test runner (`node --test`).** Zero deps, but no TS support without a separate transformer, and the assertions API is bare.

### TypeScript strictness profile

- **Decision**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`.
- **Rationale**:
  - `strict: true` enables eight separate strict flags; this is the modern default for serious TS projects.
  - `noUncheckedIndexedAccess` makes `arr[i]` return `T | undefined` instead of `T` - prevents off-by-one bugs in lane arrays.
  - `exactOptionalPropertyTypes` distinguishes "key is missing" from "key is `undefined`" - catches subtle InputEvent bugs.
- **Alternatives considered**:
  - **Loose TS (no strict).** Defeats the point of choosing TS. Rejected.

---

## Platform gotchas (educational - what the framework or our code must handle)

The user is new to game dev. These are the genuinely surprising things web games trip on, recorded here so they show up later as explicit tasks/tests rather than mystery bugs in production.

### G1. Delta-time-correct game loop

- **Decision**: Use Phaser's built-in `Scene.update(time, delta)` for any per-frame math. Compute velocities and animation progress *per delta*, not per frame.
- **Rationale**: A frame on a 144 Hz monitor is ~7 ms; on a struggling phone it can be 33 ms. Per-frame math means the game runs ~5x faster on the desktop. Phaser hands you `delta` so this is just discipline, not implementation effort.
- **Mitigation in code**: All "advance the world" calls take `dtMs` as an argument. Asserted in unit tests with deterministic delta values.

### G2. Keyboard auto-repeat suppression

- **Decision**: In `input-adapter`, treat only the *initial* keydown as input; ignore events where `KeyboardEvent.repeat === true`. Phaser's `JustDown` helper makes this trivial inside Scenes.
- **Rationale**: Without this, holding the Right arrow walks the character right - left - right - left as fast as the OS repeats keys. Spec FR-006 explicitly forbids this.
- **Mitigation in code**: `input-adapter` unit test asserts that an event stream of `{down repeat:false}, {down repeat:true}, {down repeat:true}` yields exactly one normalised InputEvent.

### G3. Touch event coalescing (no double-fire from pointer + touch)

- **Decision**: Use Phaser's unified Pointer events (the `Input` plugin's `pointerdown`/`pointerup`) rather than mixing `mousedown`/`touchstart`. Apply a 50 ms debounce in `input-adapter` to coalesce same-direction inputs that arrive from different event sources within the window.
- **Rationale**: On hybrid devices (Surface, Chromebook, iPad with mouse), a touch can fire both `touchend` and `mouseup` ~10-50 ms apart. Without coalescing, one swipe = two lane changes.
- **Mitigation in code**: `input-adapter` unit test asserts that two same-direction inputs within 50 ms produce one normalised event.

### G4. iOS audio unlock (reserved - audio is out of scope for this slice)

- **Decision**: No audio in this slice; when audio is added (later slice), call `WebAudio.unlock()` (Phaser helper) on the first user gesture - tap, click, or key.
- **Rationale**: iOS Safari refuses to play any audio until a user gesture has fired. Phaser handles this if you initialise the audio system inside an input handler.
- **Mitigation in code**: Tracked in a TODO comment in `phaser-config.ts` referring back to this section; will become a real task in the audio slice.

### G5. Scale management across 320 px - 4K screens

- **Decision**: Phaser Game Config uses `scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH, width: 720, height: 1280, parent: 'game' }`. The 720x1280 logical resolution gives a portrait-friendly mobile aspect ratio.
- **Rationale**: `Scale.FIT` keeps the aspect ratio and adds letterboxing, which is acceptable for an endless runner. Logical coordinates stay the same regardless of device, so module code never asks the screen its size - the renderer maps logical -> screen.
- **Mitigation in code**: All lane X-positions are expressed in logical units (e.g., lane centres at `x = 180, 360, 540` for a 720-wide logical canvas). Renderer asserts these are constant across resize events.

### G6. Tab visibility / focus pause

- **Decision**: Wire `document.visibilitychange` and `window.blur` to call `runner-engine.pause()`; resume on the next user gesture (key, click, tap). Phaser already pauses the game loop on tab hide, but we want our `runner-engine.distance` math to also stop accumulating.
- **Rationale**: Spec FR-011 requires pause + resume overlay. Without this, a player who switches tabs sees their distance counter run while they weren't looking.
- **Mitigation in code**: Integration test simulates a `visibilitychange` event and asserts `runner-engine.tick(1000)` does not advance distance while paused.

### G7. Window resize during a run

- **Decision**: Phaser's Scale Manager emits a `resize` event; subscribe in `renderer` only. Game logic (lane positions in logical units) is unaffected.
- **Rationale**: Mobile orientation changes and desktop window drags should not break the game.
- **Mitigation in code**: Manual test in quickstart.md; no automated test (visual concern).

---

## Module boundary enforcement

- **Decision**: ESLint rule `no-restricted-imports` with these rules:
  - `runner-engine/`, `input-adapter/`, `lane-state/`, `score/`, `question-bank/` MUST NOT import from `phaser` or from each other's internal files (only from each other's `index.ts`).
  - `renderer/` and `phaser/` MAY import from `phaser`.
  - `shared/` MUST NOT import from any other module (it sits at the bottom of the dep graph).
- **Rationale**: Encodes Constitution Principle III as a CI-enforceable rule, so a future "let me just import Phaser into lane-state real quick" change fails CI rather than slipping in.
- **Alternatives considered**:
  - **Pure convention.** Cheaper to set up; fails the moment two people work on the codebase or the original author forgets in two months. Rejected.
  - **Nx / TurboRepo workspace package boundaries.** Heavier; introduces a monorepo toolchain we don't need for this scale. Rejected for now.

---

## Hosting + deploy

- **Decision**: Cloudflare Pages, free tier. Build command `npm run build`, output directory `dist/`. Auto-deploys on push to any branch; the `main` branch is production, all others get a preview URL.
- **Rationale**:
  - Unlimited bandwidth on the free tier (only major free host with no cap).
  - Global edge CDN (~300 POPs) keeps mobile load times low.
  - Zero-config for Vite projects; Cloudflare auto-detects the framework.
  - Branch-based preview URLs make it trivial to show a WIP slice without merging.
- **Alternatives considered**:
  - **GitHub Pages.** Free, simpler, but 100 GB/mo soft bandwidth cap and no native preview-per-branch.
  - **Netlify / Vercel.** Comparable DX; 100 GB/mo bandwidth cap.
  - **Self-host on a free static-file server.** Pointless work.

---

## Reserved (do not implement now)

These are noted to prevent future "we should have thought about this" surprises. They are NOT in scope for this slice or the next.

- **Global leaderboard**: a thin `score-submit(score, name)` interface will be reserved during the scoring slice. It returns a Promise so the implementation can swap from a no-op stub to a fetch against Cloudflare D1 or Supabase later without touching callers.
- **Localisation**: all user-facing strings centralised in `shared/strings.ts` from day one so a future `i18n` slice is a search-replace, not a hunt.
- **Telemetry**: deferred entirely. Only `console.debug` for observability until/unless a real product need surfaces.
