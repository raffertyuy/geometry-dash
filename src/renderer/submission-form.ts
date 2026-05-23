export interface SubmissionFormHandlers {
  onSubmit(initials: string): void;
  onSkip(): void;
}

export interface SubmissionForm {
  open(initialInitials: string): void;
  close(): void;
  setError(message: string | null): void;
  setSubmitting(submitting: boolean): void;
  isOpen(): boolean;
  destroy(): void;
}

/**
 * Modal-style submission form for the leaderboard. Renders a 3-letter A-Z
 * initials input + Submit + Skip buttons + an inline error region.
 *
 * Keyboard: Enter → submit, Escape → skip. The form auto-uppercases input
 * and strips non-letters. Maxlength is enforced at the DOM level. Click
 * targets inside the host don't bubble to the window-level "tap to start"
 * handler (we set data-no-game-start="true" on the host).
 */
export function createSubmissionForm(
  host: HTMLElement,
  handlers: SubmissionFormHandlers,
): SubmissionForm {
  const doc = host.ownerDocument;
  let isVisible = false;
  let isSubmitting = false;
  let destroyed = false;

  host.setAttribute('data-no-game-start', 'true');
  host.classList.add('submission-form');
  // Hidden by default; open() removes the class.
  host.classList.add('hidden');

  // Build static DOM once; show/hide via .hidden class.
  const body = doc.createElement('div');
  body.className = 'submission-form__body';
  body.setAttribute('role', 'dialog');
  body.setAttribute('aria-modal', 'true');
  body.setAttribute('aria-label', 'Submit your score');

  const heading = doc.createElement('h2');
  heading.className = 'submission-form__heading';
  heading.textContent = 'You made the leaderboard!';
  body.appendChild(heading);

  const prompt = doc.createElement('p');
  prompt.className = 'submission-form__prompt';
  prompt.textContent = 'Enter your initials (1-3 letters)';
  body.appendChild(prompt);

  const input = doc.createElement('input');
  input.className = 'submission-form__input';
  input.type = 'text';
  input.maxLength = 3;
  input.autocapitalize = 'characters';
  input.spellcheck = false;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('inputmode', 'latin');
  input.setAttribute('aria-label', 'Initials');
  body.appendChild(input);

  const error = doc.createElement('p');
  error.className = 'submission-form__error';
  error.setAttribute('aria-live', 'polite');
  body.appendChild(error);

  const actions = doc.createElement('div');
  actions.className = 'submission-form__actions';

  const skipBtn = doc.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'submission-form__button submission-form__button--skip';
  skipBtn.textContent = 'Skip';
  actions.appendChild(skipBtn);

  const submitBtn = doc.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'submission-form__button submission-form__button--submit';
  submitBtn.textContent = 'Submit';
  actions.appendChild(submitBtn);

  body.appendChild(actions);
  host.appendChild(body);

  function stopPointer(event: Event): void {
    event.stopPropagation();
  }
  host.addEventListener('pointerdown', stopPointer);
  host.addEventListener('pointerup', stopPointer);

  function normaliseInput(): void {
    const cleaned = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    if (cleaned !== input.value) input.value = cleaned;
  }

  function onInput(): void {
    normaliseInput();
  }

  function submitFromInput(): void {
    if (destroyed || !isVisible || isSubmitting) return;
    normaliseInput();
    if (input.value.length === 0) {
      setError('Enter at least one letter');
      return;
    }
    setError(null);
    handlers.onSubmit(input.value);
  }

  function skip(): void {
    if (destroyed || !isVisible) return;
    handlers.onSkip();
  }

  function onSubmitClick(event: Event): void {
    event.stopPropagation();
    submitFromInput();
  }
  function onSkipClick(event: Event): void {
    event.stopPropagation();
    skip();
  }
  function onKeyDown(event: KeyboardEvent): void {
    if (!isVisible) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      submitFromInput();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      skip();
    }
  }

  submitBtn.addEventListener('click', onSubmitClick);
  skipBtn.addEventListener('click', onSkipClick);
  input.addEventListener('input', onInput);
  // Window-level keydown listener; only fires when visible.
  const win = doc.defaultView ?? window;
  win.addEventListener('keydown', onKeyDown, true);

  function open(initialInitials: string): void {
    if (destroyed) return;
    isVisible = true;
    isSubmitting = false;
    error.textContent = '';
    error.classList.remove('submission-form__error--visible');
    input.value = (initialInitials ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    submitBtn.removeAttribute('disabled');
    skipBtn.removeAttribute('disabled');
    host.classList.remove('hidden');
    // Defer focus so any in-flight game-over render doesn't steal it.
    setTimeout(() => {
      try {
        input.focus();
        input.select();
      } catch {
        // jsdom / SSR safety: focus may not be supported.
      }
    }, 0);
  }

  function close(): void {
    if (destroyed) return;
    isVisible = false;
    isSubmitting = false;
    host.classList.add('hidden');
  }

  function setError(message: string | null): void {
    if (destroyed) return;
    if (message === null) {
      error.textContent = '';
      error.classList.remove('submission-form__error--visible');
    } else {
      error.textContent = message;
      error.classList.add('submission-form__error--visible');
    }
  }

  function setSubmitting(submitting: boolean): void {
    if (destroyed) return;
    isSubmitting = submitting;
    if (submitting) {
      submitBtn.setAttribute('disabled', 'true');
      skipBtn.setAttribute('disabled', 'true');
    } else {
      submitBtn.removeAttribute('disabled');
      skipBtn.removeAttribute('disabled');
    }
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    submitBtn.removeEventListener('click', onSubmitClick);
    skipBtn.removeEventListener('click', onSkipClick);
    input.removeEventListener('input', onInput);
    win.removeEventListener('keydown', onKeyDown, true);
    host.removeEventListener('pointerdown', stopPointer);
    host.removeEventListener('pointerup', stopPointer);
    host.innerHTML = '';
  }

  return { open, close, setError, setSubmitting, isOpen: () => isVisible, destroy };
}
