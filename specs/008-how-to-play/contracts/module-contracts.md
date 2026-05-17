# Module Contracts: How-to-Play Modal & In-Game Pause

**Slice**: 008-how-to-play · **Date**: 2026-05-17

---

## 1. NEW: `src/renderer/how-to-play-modal.ts`

```ts
export interface HowToPlayModal {
  /**
   * Opens the modal in the given mode. Idempotent — calling show() while
   * already open is a no-op (FR-016).
   */
  show(mode: 'entry' | 'pause'): void;
  close(): void;
  isVisible(): boolean;
  destroy(): void;
}

export function createHowToPlayModal(
  host: HTMLElement,
  sources: readonly ProblemSource[],
  onResume?: () => void,
): HowToPlayModal;
```

**Behaviour**:

- `show('entry')` sets internal mode to `'entry'`, builds the body if not built, adds the visible classes, and emits `how_to_play_opened` debug event.
- `show('pause')` does the same with mode `'pause'`. The caller is expected to have already transitioned the world to `'paused'` via the existing `pauseRun` reducer; the modal does NOT touch world state itself.
- `close()` removes visible classes, emits `how_to_play_closed` with `mode` and `resumed=(mode==='pause')`. If `mode === 'pause'` AND `onResume` was provided at construction, `onResume()` is called *after* the close.
- ESC, SPACE, and the X close button all route through `close()`. ESC and SPACE are listened for at the **capture** phase with `preventDefault + stopPropagation` so the next "any-key" handler in the game-loop does not also fire (FR-008 edge case 5).
- Click outside the modal body (on the dimmed backdrop) also closes. Inside-body clicks do not.
- `destroy()` is idempotent and removes all listeners.

**Body structure** (single render at first `show()` to avoid rebuilding):

```html
<div class="how-to-play-body">
  <button class="close-button" aria-label="Close">×</button>
  <h2>How to Play</h2>

  <section class="htp-section htp-general-rules">
    <h3>General Rules</h3>
    <ul>…</ul>
  </section>

  <section class="htp-section htp-problem-cubes">
    <h3>Problem Cubes</h3>
    <ul class="htp-cube-rows">
      <li class="htp-cube-row htp-cube-row--b">
        <span class="cube-swatch" style="background-color: …; …" aria-hidden="true"></span>
        <div class="htp-cube-text">
          <div class="htp-cube-label">Basic</div>
          <p>… description …</p>
          <div class="htp-cube-stats">±1,000 pts · 60 s to answer</div>
        </div>
      </li>
      <!-- repeat for M and A -->
    </ul>
  </section>

  <section class="htp-section htp-credits">
    <h3>Credits</h3>
    <ul class="credits-list">…<!-- source rows --></ul>
  </section>
</div>
```

The Credits section is rendered identically to the current credits-panel's source list (so attribution fields are preserved, SC-003).

---

## 2. NEW: `src/renderer/pause-button.ts`

```ts
export interface PauseButton {
  /** Show or hide the button (controls render). */
  setVisible(visible: boolean): void;
  /** Enable / disable while visible. */
  setEnabled(enabled: boolean): void;
  /** Read-only accessor for the game-loop's ESC/SPACE branch. */
  isEnabled(): boolean;
  destroy(): void;
}

export function createPauseButton(
  host: HTMLButtonElement,
  onPress: () => void,
): PauseButton;
```

**Behaviour**:

- Construction binds a single `click` listener on `host`. The listener fires `onPress()` only when the button is currently enabled.
- `setVisible(false)` adds `.hidden` to the host and disables it implicitly.
- `setEnabled(true)` removes `disabled` attribute + `aria-disabled` and removes a `.is-disabled` class. `setEnabled(false)` is the inverse.
- `destroy()` removes the listener.

---

## 3. MODIFIED: `src/game/game-loop.ts`

- Replace `CreditsPanel` + `createCreditsPanel` imports with `HowToPlayModal` + `createHowToPlayModal`.
- Replace `creditsPanel` local with `howToPlayModal`. Construct with `onResume: resumeFromPauseButton` (new local function that calls `resumeRun` + `loopState = 'running'`).
- Replace `host.creditsOverlay` reads with `host.howToPlayOverlay`. Replace `host.creditsLinkStart` / `creditsLinkGameOver` reads with `host.howToPlayLinkStart` / `howToPlayLinkGameOver`. The replacement is mechanical — the open-listener body becomes `howToPlayModal.show('entry')`.
- Add `host.pauseButton: HTMLButtonElement` to `GameLoopHostElements`. Construct `createPauseButton(host.pauseButton, onPauseButtonPressed)`.
- New `onPauseButtonPressed()`: world = pauseRun(world); loopState = 'paused'; howToPlayModal.show('pause'). Emits `pause_button_pressed`.
- New `resumeFromPauseButton()` (the `onResume` passed to the modal): world = resumeRun(world); loopState = 'running'. NOTE: this is distinct from `resumeFromInput()` which is used by the blur-pause overlay; both end up at `resumeRun` but only the input-driven one re-shows the canvas pause-overlay (which is irrelevant here).
- ESC/SPACE branch in `onKeyDown`: if `loopState === 'running'` AND `pauseButton.isEnabled()` AND key is `Escape` or `' '`, call `onPauseButtonPressed()` and return.
- Each frame, after the world is updated and rendering is done, compute Pause button state per data-model §2 and pass to `pauseButton.setVisible` + `setEnabled`. Place this next to `livesHud.set(...)` for adjacency.
- On `destroy()`: `howToPlayModal.destroy()`, `pauseButton.destroy()`. Delete the old `creditsPanel.destroy()` line.

---

## 4. MODIFIED: `src/main.ts`

- Rename the three credits-related DOM queries to their how-to-play equivalents:
  - `#credits-overlay` → `#how-to-play-overlay`
  - `#credits-link-start` → `#how-to-play-link-start`
  - `#credits-link-game-over` → `#how-to-play-link-game-over`
- Add a new query for `#pause-button` and include it in the `GameLoopHostElements` payload.

---

## 5. MODIFIED: `index.html`

- Replace the two `<button id="credits-link-…" class="credits-link">Problem credits</button>` elements with `<button id="how-to-play-link-…" class="how-to-play-link" type="button">How to Play</button>`.
- Rename `#credits-overlay` → `#how-to-play-overlay`. The `.credits-link` CSS class is renamed to `.how-to-play-link` (same styling preserved).
- Add a new top-of-playfield button:

  ```html
  <button id="pause-button" class="pause-button hidden" type="button" aria-label="Pause">⏸</button>
  ```

- Add the modal-section CSS (heading sizes, cube-swatch + row layout, two-column → stacked at 320 px) plus the pause-button CSS (positioning at top-centre or top-right consistent with the existing HUD).

---

## 6. DELETED: `src/renderer/credits-panel.ts` and `src/renderer/credits-panel.test.ts`

The new modal's Credits section assumes the responsibility. `src/renderer/index.ts` drops the `createCreditsPanel` export and gains `createHowToPlayModal` + `createPauseButton`.

---

## 7. Out of scope (explicitly)

- No new accessibility-friendly "show me the rules every run" persistent flag — the modal opens on click only.
- No analytics event sink (the project has none).
- No nested modal stacks — the Pause button is disabled while the gate modal is open, so the modal-on-modal scenario cannot arise.
- No deletion of `LICENSES.md` (the legal in-repo file stays as the canonical record).
