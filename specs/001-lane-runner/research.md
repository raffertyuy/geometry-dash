# Research: Lane Runner Core Movement (Phase 0)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

The spec had no remaining `[NEEDS CLARIFICATION]` markers, so this research focuses on the tech-stack decisions and the platform gotchas the user (a first-time game developer) should know about. Each decision section follows: **Decision** / **Rationale** / **Alternatives considered**.

---

## Tech-stack decisions

### Pivot from Phaser to Three.js (2026-05-16 evening)

- **Decision**: Replace Phaser 3 with Three.js (^0.170) as the runtime rendering library. Same evening as the initial Phaser-based MVP was playtested.
- **Trigger**: After manually validating the 2D Phaser MVP (T028 acceptance scenarios all passed), the user clarified they actually wanted a 3D look modelled on polygon.uy.sg (a low-poly Three.js shooter we inspected: uses Three.js 0.160 + GLTFLoader r147, vanilla `<script>` tags, DOM HUD over the WebGL canvas).
- **Rationale**:
  - The library-first architecture from the original plan was deliberately structured to make this kind of swap cheap: lane-state, runner-engine, input-adapter, swipe-detector are all framework-agnostic. The pivot only touched `src/renderer/`, `src/phaser/` (renamed to `src/game/`), `index.html`, the dependency list, and the ESLint boundary rule. **All 59 pure-logic tests passed unchanged.**
  - Bundle size went DOWN: Three.js core ~150 KB gzipped vs Phaser ~220 KB gzipped. Net change to our gzipped JS budget: -70 KB freed.
  - Three.js maps the game's spatial mental model (three lanes spaced in X, distance accruing in Z, camera behind/above the player) cleanly onto a 3D scene. Doing the same in 2D required fake parallax/scrolling that fought the perspective-runner aesthetic.
- **What we GAVE UP vs Phaser**:
  - Phaser's Scale Manager (free responsive layout) - replaced by ~15 lines of `window.addEventListener('resize', ...)` updating camera aspect and renderer size.
  - Phaser's Scene system (Boot/Start/Run lifecycle) - replaced by a small state enum + DOM overlays for the start/pause screens.
  - Phaser's input plugin (gesture detection, pointer/touch/mouse normalisation) - was never really used; the `input-adapter` already does this.
  - Phaser's audio system - not used yet; will likely use Howler.js or the WebAudio API directly when audio is added.
- **Alternatives considered (during the pivot)**:
  - **Babylon.js.** Comparable 3D engine, more batteries-included than Three.js but larger bundle (~400 KB gzipped). Rejected because polygon.uy.sg uses Three.js and that's the user's reference design.
  - **Raw WebGL.** Hand-roll the renderer. Rejected: weeks of work for no real Library-First gain (we'd still wrap WebGL in a renderer module the rest of the code calls).
  - **Stay on Phaser and use a Phaser 3D plugin** (e.g. `phaser3-rex-plugins/Tap`, or the experimental `Phaser.Cameras.Sprite3D`). Rejected: these are not Phaser's core competency; community quality is uneven; we'd still be paying Phaser's ~220 KB on top.

### Why a 3D rendering library at all (vs raw WebGL or another 3D lib)

- **Decision**: Use Three.js (chosen above), not raw WebGL or a different abstraction.
- **Rationale**:
  - WebGL is a low-level API; building a minimum-viable lane runner directly on it would take weeks. A scene graph + camera + lighting + mesh primitives in 50 lines of Three.js would be hundreds of lines of WebGL shader + buffer setup.
  - Three.js has the strongest community and documentation of any browser 3D library. GLTF model loading, post-processing, materials, lighting - all well-trodden ground.
  - First-class TypeScript support (types ship in the package since 0.140-ish; no `@types/three` needed).
  - Polygon.uy.sg (the user's reference design) uses Three.js, so any "how did they do X?" lookup translates directly.
- **Alternatives considered**: Babylon.js (larger), PlayCanvas (heavyweight), raw WebGL (too much yak-shaving for the slice).

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

- **Decision**: The `requestAnimationFrame` callback computes `dtMs = now - lastNow` and passes it to `tickPlayer(dtMs)` and `tickWorld(dtMs)`. Cap `dtMs` at 100 ms to avoid huge jumps after a long pause.
- **Rationale**: A frame on a 144 Hz monitor is ~7 ms; on a struggling phone it can be 33 ms. Per-frame math means the game runs ~5x faster on the desktop. Three.js does NOT provide a managed loop (unlike Phaser); we own this and benefit from explicit control.
- **Mitigation in code**: All "advance the world" calls take `dtMs` as their parameter (canonical name across the codebase per `contracts/module-contracts.md`). Asserted in unit tests with deterministic `dtMs` values.

### G2. Keyboard auto-repeat suppression

- **Decision**: In `input-adapter`, treat only the *initial* keydown as input; ignore events where `KeyboardEvent.repeat === true`. Bridge in `src/game/game-loop.ts` reads `event.repeat` directly from the DOM event.
- **Rationale**: Without this, holding the Right arrow walks the character right - left - right - left as fast as the OS repeats keys. Spec FR-006 explicitly forbids this.
- **Mitigation in code**: `input-adapter` unit test asserts that an event stream of `{down repeat:false}, {down repeat:true}, {down repeat:true}` yields exactly one normalised InputEvent.

### G3. Touch event coalescing (no double-fire from pointer + touch)

- **Decision**: Use the DOM `pointerdown` / `pointerup` events (unified pointer events handle mouse + touch + pen). Apply a 50 ms debounce in `input-adapter` to coalesce same-direction inputs from different event sources.
- **Rationale**: On hybrid devices (Surface, Chromebook, iPad with mouse), a touch can fire both `touchend` and `mouseup` ~10-50 ms apart. Without coalescing, one swipe = two lane changes. Pointer events unify these but the cross-source coalesce still helps when a player physically touches AND hits a key in the same intent.
- **Mitigation in code**: `input-adapter` unit test asserts that two same-direction inputs within 50 ms produce one normalised event.

### G4. iOS audio unlock (reserved - audio is out of scope for this slice)

- **Decision**: No audio in this slice; when audio is added (later slice), use the WebAudio API or Howler.js and call `audioContext.resume()` (or equivalent) on the first user gesture - tap, click, or key.
- **Rationale**: iOS Safari refuses to play any audio until a user gesture has fired. This is a browser-platform requirement that Three.js does not address (it has no built-in audio system); we own it directly.
- **Mitigation in code**: Tracked in a TODO comment in `game/game-loop.ts` referring back to this section; will become a real task in the audio slice.

### G5. Scale management across 320 px - 4K screens

- **Decision**: The canvas fills `100vw x 100vh`; a single `window.addEventListener('resize', ...)` handler updates `camera.aspect` and `renderer.setSize(width, height, false)`. Three.js's perspective camera uses field-of-view + aspect ratio, so the geometry stays correct on any viewport. Pixel ratio is set via `renderer.setPixelRatio(devicePixelRatio)` capped at 2 to avoid burning fill rate on retina displays.
- **Rationale**: Unlike a 2D fixed-canvas game, a 3D scene is naturally resolution-independent; the camera FOV determines what fits on screen. World units (lane X, distance Z) stay the same regardless of device.
- **Mitigation in code**: Lane X positions live in `shared/config.ts` as 3D world units (`{ left: -2, centre: 0, right: 2 }`). The renderer uses them directly.

### G6. Tab visibility / focus pause

- **Decision**: Wire `document.visibilitychange` and `window.blur` to call `runner-engine.pauseRun()`; require a user gesture (key, click, tap) to resume. The game loop short-circuits (returns early without ticking) when `isAwaitingResume === true`.
- **Rationale**: Spec FR-011 requires pause + resume overlay. Three.js does NOT auto-pause when the tab is hidden, but `requestAnimationFrame` callbacks are throttled to ~once per second in background tabs by all major browsers - so without our explicit pause, distance would crawl forward, not freeze.
- **Mitigation in code**: Integration test simulates a `visibilitychange` event and asserts `runner-engine.tick(1000)` does not advance distance while paused.

### G7. Window resize during a run

- **Decision**: `window.addEventListener('resize', ...)` calls `renderer.resize(window.innerWidth, window.innerHeight)`. The renderer recalculates camera aspect and renderer size; game logic is untouched.
- **Rationale**: Mobile orientation changes and desktop window drags should not break the game. Three.js gives us the building blocks; we wire the listener ourselves.
- **Mitigation in code**: Manual test in quickstart.md; no automated test (visual concern).

---

## Module boundary enforcement

- **Decision**: ESLint rule `no-restricted-imports` with these rules:
  - `runner-engine/`, `input-adapter/`, `lane-state/`, `score/`, `question-bank/` MUST NOT import from `three` or from each other's internal files (only from each other's `index.ts`).
  - `renderer/` and `game/` MAY import from `three`.
  - `shared/` MUST NOT import from any other module (it sits at the bottom of the dep graph).
- **Rationale**: Encodes Constitution Principle III as a CI-enforceable rule, so a future "let me just import Three.js into lane-state real quick" change fails CI rather than slipping in. The Phaser->Three.js pivot validated this in practice - the same rule just had to swap one library name.
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
