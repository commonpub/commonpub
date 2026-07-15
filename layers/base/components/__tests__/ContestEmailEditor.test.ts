/**
 * Component test for the per-contest email editor (session 232). Lives under
 * components/__tests__ (bracket-free) so packaging excludes it. Exercises: load of
 * stored copy on mount, the sandboxed live preview, the per-template token help,
 * subject edits emitting update:modelValue, and an axe scan.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import ContestEmailEditor from '../contest/ContestEmailEditor.vue';

const EMPTY = { confirmationSubject: '', confirmationIntro: '', confirmationBlocks: [], reminderSubject: '', reminderIntro: '', reminderBlocks: [] };

const $fetch = vi.fn(async (url: string) => {
  if (String(url).includes('email-preview')) return { html: '<p>PREVIEW_BODY</p>', subject: 'Sub' };
  if (String(url).includes('email-copy')) return { confirmation: { subject: 'Stored subject' } };
  return {};
});
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
Object.assign(globalThis, { $fetch, useToast: () => toast });

beforeEach(() => $fetch.mockClear());

describe('ContestEmailEditor', () => {
  it('loads the stored override on mount and renders a sandboxed preview', async () => {
    const { emitted, findByTitle } = render(ContestEmailEditor, { props: { slug: 'my-contest', modelValue: { ...EMPTY } } });
    const frame = (await findByTitle('Email preview')) as HTMLIFrameElement;
    expect(frame.getAttribute('sandbox')).toBe(''); // scripts blocked
    expect(frame.getAttribute('srcdoc')).toContain('PREVIEW_BODY');
    expect($fetch).toHaveBeenCalledWith('/api/contests/my-contest/email-copy');
    await vi.waitFor(() => expect(emitted().load).toBeTruthy());
    expect(emitted().load![0]).toEqual([{ confirmation: { subject: 'Stored subject' } }]);
  });

  it('shows the per-template token allow-list and swaps it on template change', async () => {
    const { getByText, queryByText } = render(ContestEmailEditor, { props: { slug: 'c', modelValue: { ...EMPTY } } });
    expect(getByText('{contestTitle}')).toBeTruthy();
    expect(queryByText('{timeRemaining}')).toBeNull(); // confirmation has no timeRemaining
    await fireEvent.click(getByText('Deadline reminder'));
    expect(getByText('{timeRemaining}')).toBeTruthy();
  });

  it('emits update:modelValue when the subject is edited', async () => {
    const { container, emitted } = render(ContestEmailEditor, { props: { slug: 'c', modelValue: { ...EMPTY } } });
    const subj = container.querySelector('input[type="text"]') as HTMLInputElement;
    await fireEvent.update(subj, 'Welcome {username}');
    const events = emitted()['update:modelValue'] as Array<[typeof EMPTY]> | undefined;
    expect(events).toBeTruthy();
    expect(events!.at(-1)![0].confirmationSubject).toBe('Welcome {username}');
  });

  it('posts a preview request for the selected template', async () => {
    render(ContestEmailEditor, { props: { slug: 'c', modelValue: { ...EMPTY, confirmationSubject: 'Hi' } } });
    await vi.waitFor(() =>
      expect($fetch).toHaveBeenCalledWith('/api/contests/c/email-preview', expect.objectContaining({ method: 'POST' })),
    );
  });

  it('passes an axe scan', async () => {
    const { container } = render(ContestEmailEditor, { props: { slug: 'c', modelValue: { ...EMPTY } } });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
