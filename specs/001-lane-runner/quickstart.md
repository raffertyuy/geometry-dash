# Quickstart: Lane Runner Core Movement

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

This is the runbook for developing, testing, building, and deploying this slice. It also doubles as the "did the slice actually work?" validation script - once `npm run dev` shows lane-switching working on both desktop and a phone, the slice is done.

## Prerequisites

- **Node.js** 20.x or 22.x (LTS). Check with `node --version`.
- **npm** 10+ (ships with Node 20+). Check with `npm --version`.
- **Git** (already installed; this is in a git repo).
- A modern browser for testing: latest Chrome/Firefox/Safari/Edge.
- For touch testing: either an actual phone on the same network as your dev machine, or Chrome DevTools device emulation.

No Cloudflare account is required to develop locally; an account is only needed for the final hosting step.

## 1. Install dependencies

From the repo root, on branch `001-lane-runner`:

```powershell
npm install
```

After `/speckit-tasks` and the implementation slice complete, `package.json` will list `three`, `vite`, `typescript`, `vitest`, and a small set of dev dependencies. (Pre-pivot listed `phaser` instead of `three`.)

## 2. Run the dev server

```powershell
npm run dev
```

This starts Vite on `http://localhost:5173`. The game auto-reloads on file changes (HMR).

**Validate the slice (US1 - desktop keyboard)**:

1. Open `http://localhost:5173` in a desktop browser.
2. Press any key on the start screen - run begins, character is centred in the middle lane.
3. Press Left Arrow - character slides left to the left lane. Press again - it stays (clamped at boundary).
4. Press Right Arrow twice - character slides centre → right.
5. Press 'A' / 'D' - same behaviour as the arrows.
6. Hold Right Arrow for 5 seconds - character moves exactly one lane (no key-repeat skipping).
7. Switch tabs - run pauses. Switch back and tap/press - run resumes.

**Validate the slice (US2 - mobile/touch)**:

Option A - same machine via Chrome DevTools:
1. With the dev server running, open Chrome DevTools → toggle Device Toolbar (Ctrl/Cmd+Shift+M).
2. Select "iPhone 14" or similar.
3. Swipe left/right inside the canvas with the mouse. Lane changes should fire.

Option B - actual phone:
1. Find your machine's LAN IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux).
2. Browse to `http://<your-ip>:5173` from your phone on the same Wi-Fi.
3. Tap to start, then swipe left/right.

**Validate the debug overlay**:

Append `?debug=1` to the URL. A small overlay top-left shows `lane`, `animProgress`, `speed`, `distance`, `lastInput`.

## 3. Run tests

```powershell
# One-shot run
npm test

# Watch mode (re-runs on file change)
npm run test:watch

# With coverage report
npm run test:coverage
```

This runs every `*.test.ts` in `src/` and `tests/`. They MUST all pass before the slice is considered done. Per Constitution Principle II, every non-trivial logic change MUST come with the matching test red-first, then green.

Expected test count for this slice (rough): ~25 - 35 unit tests across `lane-state`, `input-adapter`, `swipe-detector`, `runner-engine`; ~3 - 5 integration tests in `tests/integration/`.

## 4. Type-check (no emit)

```powershell
npm run typecheck
```

Runs `tsc --noEmit` against the strict config. CI will block PRs that fail type-checking.

## 5. Lint (boundary enforcement)

```powershell
npm run lint
```

This is where Constitution Principle III is enforced: a `lane-state.ts` that tries to `import 'three'` will fail here, not in code review.

## 6. Production build

```powershell
npm run build
```

This produces a `dist/` folder containing the hashed, minified static files (one HTML, one JS bundle, public assets). Verify:

- `dist/index.html` exists.
- `dist/assets/index-*.js` exists and is < 500 KB gzipped (CI step will assert this).
- Open `dist/index.html` directly in a browser - it should still load (Vite produces files that work served as static).

For a local production-mode preview:

```powershell
npm run preview
```

Same as `npm run dev` but serving the built `dist/`. Catches "works in dev, breaks in build" regressions.

## 7. Deploy to Cloudflare Pages

One-time setup:

1. Sign in at [pages.cloudflare.com](https://pages.cloudflare.com).
2. Click **Create a project** → **Connect to Git** → choose this repository.
3. Configure the build:
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node version**: set the `NODE_VERSION` environment variable to `20`.
4. Save and deploy. Cloudflare runs the build and serves it at `<project-name>.pages.dev`.

After this:

- Every push to `main` triggers a production deploy.
- Every push to a feature branch (like `001-lane-runner`) gets its own preview URL (e.g. `001-lane-runner.<project-name>.pages.dev`).
- Custom domain (later): Cloudflare → project → **Custom domains** → add. DNS is automatic if the domain is also on Cloudflare; otherwise add the CNAME record at your registrar.

## 8. Definition of done for this slice

The slice ships when ALL of these are true:

- [x] All unit tests green (`npm test` exit 0).
- [x] `npm run typecheck` exits 0.
- [x] `npm run lint` exits 0.
- [x] `npm run build` produces a `dist/` under the 500 KB gzipped critical-JS budget.
- [x] Acceptance scenarios in [spec.md](./spec.md) §"User Story 1" all pass on desktop.
- [x] Acceptance scenarios in [spec.md](./spec.md) §"User Story 2" all pass on a real phone OR Chrome DevTools touch emulation.
- [x] Edge cases listed in [spec.md](./spec.md) §"Edge Cases" exhibit the documented behaviour (manual checks).
- [x] Cloudflare Pages preview URL on this branch is reachable and playable on both desktop and a mobile browser.

When that list is checked, the slice is mergeable to `main`.

## Common gotchas (referenced from [research.md](./research.md))

- **G2** "Held key skips lanes" - check `KeyboardEvent.repeat` filtering in `input-adapter.handleKeyDown`.
- **G3** "Tap fires two lane changes" - check the 50 ms coalesce window in `input-adapter`.
- **G5** "Mobile looks wrong / cropped" - check the `window.resize` handler in `src/game/game-loop.ts` and that `camera.aspect` + `renderer.setSize` are being called.
- **G6** "Distance kept advancing after I closed the tab" - check the `visibilitychange` wiring in `main.ts`.
- **G1** "Runs faster on my laptop than my phone" - check that `tickWorld` and `tickPlayer` take `dtMs` (delta), not assume a fixed frame budget.
