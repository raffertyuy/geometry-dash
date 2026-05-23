// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSubmissionForm, type SubmissionForm } from './submission-form';

let host: HTMLElement;
let onSubmit: ReturnType<typeof vi.fn>;
let onSkip: ReturnType<typeof vi.fn>;
let form: SubmissionForm;

beforeEach(() => {
  document.body.innerHTML = '<section id="form"></section>';
  host = document.querySelector<HTMLElement>('#form')!;
  onSubmit = vi.fn();
  onSkip = vi.fn();
  form = createSubmissionForm(host, { onSubmit, onSkip });
});

afterEach(() => {
  form.destroy();
});

describe('createSubmissionForm', () => {
  it('sets data-no-game-start on the host', () => {
    expect(host.getAttribute('data-no-game-start')).toBe('true');
  });

  it('builds the static DOM up front (heading, input, buttons)', () => {
    expect(host.querySelector('.submission-form__heading')).not.toBeNull();
    expect(host.querySelector('.submission-form__input')).not.toBeNull();
    expect(host.querySelector('.submission-form__button--submit')).not.toBeNull();
    expect(host.querySelector('.submission-form__button--skip')).not.toBeNull();
  });

  it('hidden by default', () => {
    expect(host.classList.contains('hidden')).toBe(true);
    expect(form.isOpen()).toBe(false);
  });

  it('open() populates the input and removes hidden', () => {
    form.open('RAF');
    expect(host.classList.contains('hidden')).toBe(false);
    const input = host.querySelector<HTMLInputElement>('.submission-form__input')!;
    expect(input.value).toBe('RAF');
    expect(form.isOpen()).toBe(true);
  });

  it('open() normalises the initial value (uppercase + strip + truncate)', () => {
    form.open('r@fty');
    const input = host.querySelector<HTMLInputElement>('.submission-form__input')!;
    expect(input.value).toBe('RFT');
  });

  it('input auto-uppercases and strips non-letters', () => {
    form.open('AAA');
    const input = host.querySelector<HTMLInputElement>('.submission-form__input')!;
    input.value = 'r3f!';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('RF');
  });

  it('Submit click calls onSubmit with the trimmed initials', () => {
    form.open('AAA');
    const input = host.querySelector<HTMLInputElement>('.submission-form__input')!;
    input.value = 'RAF';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const submit = host.querySelector<HTMLButtonElement>('.submission-form__button--submit')!;
    submit.click();
    expect(onSubmit).toHaveBeenCalledWith('RAF');
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('Skip click calls onSkip and not onSubmit', () => {
    form.open('AAA');
    const skip = host.querySelector<HTMLButtonElement>('.submission-form__button--skip')!;
    skip.click();
    expect(onSkip).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Enter key triggers submit', () => {
    form.open('AAA');
    const input = host.querySelector<HTMLInputElement>('.submission-form__input')!;
    input.value = 'RAF';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onSubmit).toHaveBeenCalledWith('RAF');
  });

  it('Escape key triggers skip', () => {
    form.open('AAA');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('refuses to submit an empty value (shows error)', () => {
    form.open('AAA');
    const input = host.querySelector<HTMLInputElement>('.submission-form__input')!;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const submit = host.querySelector<HTMLButtonElement>('.submission-form__button--submit')!;
    submit.click();
    expect(onSubmit).not.toHaveBeenCalled();
    const err = host.querySelector('.submission-form__error');
    expect(err?.textContent).toContain('Enter at least');
  });

  it('setError(msg) shows the error; setError(null) clears it', () => {
    form.open('AAA');
    form.setError('Try different initials');
    const err = host.querySelector('.submission-form__error');
    expect(err?.textContent).toBe('Try different initials');
    expect(err?.classList.contains('submission-form__error--visible')).toBe(true);
    form.setError(null);
    expect(err?.textContent).toBe('');
    expect(err?.classList.contains('submission-form__error--visible')).toBe(false);
  });

  it('setSubmitting(true) disables both buttons; setSubmitting(false) re-enables', () => {
    form.open('AAA');
    form.setSubmitting(true);
    const submit = host.querySelector<HTMLButtonElement>('.submission-form__button--submit')!;
    const skip = host.querySelector<HTMLButtonElement>('.submission-form__button--skip')!;
    expect(submit.hasAttribute('disabled')).toBe(true);
    expect(skip.hasAttribute('disabled')).toBe(true);
    form.setSubmitting(false);
    expect(submit.hasAttribute('disabled')).toBe(false);
    expect(skip.hasAttribute('disabled')).toBe(false);
  });

  it('does not submit while submitting:true', () => {
    form.open('AAA');
    form.setSubmitting(true);
    const input = host.querySelector<HTMLInputElement>('.submission-form__input')!;
    input.value = 'RAF';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('close() hides the host and stops handling keys', () => {
    form.open('AAA');
    form.close();
    expect(host.classList.contains('hidden')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('absorbs pointerdown inside the host (stopPropagation)', () => {
    form.open('AAA');
    let bubbled = false;
    window.addEventListener('pointerdown', () => {
      bubbled = true;
    });
    host.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(bubbled).toBe(false);
  });

  it('destroy removes listeners and clears the host', () => {
    form.open('AAA');
    form.destroy();
    expect(host.innerHTML).toBe('');
  });
});
