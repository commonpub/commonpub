import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { render, fireEvent, waitFor } from '@testing-library/vue';
import axe from 'axe-core';
import ContestAnnouncementComposer from '../ContestAnnouncementComposer.vue';

// The organizer composer. BlockCanvas (a real package import in the SFC) and the
// Nuxt auto-imports absent in vitest are stubbed; this focuses on the guards that
// stand between a compose box and every participant's inbox.

// `useBlockEditor` and `BlockCanvas` are REAL package imports in the SFC, not Nuxt
// auto-imports, so a globalThis stub never reaches them -- the module itself has
// to be mocked. `editorBlocks` is then the block list the component sees, and a
// test can empty it the way an organizer deleting every block would.
const editorBlocks = ref<unknown[]>([]);
vi.mock('@commonpub/editor/vue', () => ({
  useBlockEditor: () => ({
    blocks: editorBlocks,
    fromBlockTuples: (t: unknown[]) => { editorBlocks.value = t; },
    toBlockTuples: () => editorBlocks.value,
  }),
  BlockCanvas: { props: ['blockEditor', 'blockTypes'], template: '<div class="bc-stub" />' },
}));

type Call = { url: string; opts?: { method?: string; body?: Record<string, unknown> } };
let calls: Call[];
let toasts: { msg: string; kind: string }[];

/** The Nuxt auto-imports the composer uses, which vitest does not provide.
 *  `emailNotifications` defaults ON: with it off the composer correctly refuses
 *  to send, which is its own test below. */
function installGlobals(over: { onSend?: (body: unknown) => unknown; delivery?: boolean } = {}): void {
  Object.assign(globalThis, {
    useFeatures: () => ({ features: ref({ emailNotifications: over.delivery ?? true }) }),
    useToast: () => ({
      success: (msg: string) => toasts.push({ msg, kind: 'success' }),
      error: (msg: string) => toasts.push({ msg, kind: 'error' }),
      show: (msg: string, kind = 'info') => toasts.push({ msg, kind }),
    }),
    $fetch: vi.fn(async (url: string, opts?: Call['opts']) => {
      calls.push({ url, opts });
      if (url.endsWith('/announcements/recipients')) return { count: 7 };
      if (url.endsWith('/announcements/preview')) return { html: '<p>preview</p>', subject: 'S' };
      if (url.endsWith('/announcements/test')) return { sent: true, to: 'a@b.com' };
      if (url.endsWith('/user-search')) return [];
      if (url.endsWith('/announcements') && opts?.method === 'POST') {
        return over.onSend ? over.onSend(opts.body) : { announcementId: 'a1', recipientCount: 7, duplicate: false };
      }
      return [];
    }),
  });
}

function mount() {
  return render(ContestAnnouncementComposer, { props: { slug: 'summer' } });
}

/** The subject field: the first text input in the form. */
function subjectInput(container: Element): HTMLInputElement {
  return container.querySelector('input[type="text"]') as HTMLInputElement;
}

describe('ContestAnnouncementComposer', () => {
  beforeEach(() => {
    calls = [];
    toasts = [];
    editorBlocks.value = [];
    installGlobals();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('shows how many people the chosen audience reaches', async () => {
    const { getByText } = mount();
    await waitFor(() => expect(getByText(/will receive this/)).toBeTruthy());
    expect(getByText('7')).toBeTruthy();
  });

  it('offers the four audiences as an accessible radio group', () => {
    const { getByRole, getAllByRole } = mount();
    expect(getByRole('radiogroup', { name: /Who gets this/i })).toBeTruthy();
    const radios = getAllByRole('radio');
    // everyone registered / full only / reminders-only / specific people
    expect(radios).toHaveLength(4);
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true');
    expect(getByRole('radio', { name: /Specific people/i })).toBeTruthy();
  });

  // Picking individuals is the third thing an organizer asked for, alongside the
  // whole registration and the reminders-only subscribers.
  it('cannot send to "specific people" until at least one person is picked', async () => {
    const { getByRole, container } = mount();
    await fireEvent.update(subjectInput(container), 'An update');
    await fireEvent.click(getByRole('radio', { name: /Specific people/i }));
    await nextTick();
    expect((getByRole('button', { name: /Send to participants/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(getByRole('textbox', { name: /Search people/i })).toBeTruthy();
  });

  it('re-counts recipients when the audience changes', async () => {
    const { getAllByRole } = mount();
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/recipients'))).toBe(true));
    calls.length = 0;
    await fireEvent.click(getAllByRole('radio')[1]!);
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/recipients'))).toBe(true));
  });

  // A blast is irreversible, so it must not be one click away.
  it('requires an explicit confirmation before it sends anything', async () => {
    const { getByRole, queryByRole, container } = mount();
    await fireEvent.update(subjectInput(container), 'An update');

    expect(queryByRole('button', { name: /Yes, send it/ })).toBeNull();
    await fireEvent.click(getByRole('button', { name: /Send to participants/ }));
    expect(getByRole('button', { name: /Yes, send it/ })).toBeTruthy();
    // Still nothing sent.
    expect(calls.some((c) => c.opts?.method === 'POST' && c.url.endsWith('/announcements'))).toBe(false);
  });

  it('sends an idempotency key, so a double-click cannot mail everyone twice', async () => {
    const { getByRole, container } = mount();
    await fireEvent.update(subjectInput(container), 'An update');
    await fireEvent.click(getByRole('button', { name: /Send to participants/ }));
    await fireEvent.click(getByRole('button', { name: /Yes, send it/ }));

    await waitFor(() => {
      const send = calls.find((c) => c.opts?.method === 'POST' && c.url.endsWith('/announcements'));
      expect(send).toBeTruthy();
      expect(String(send!.opts!.body!.idempotencyKey).length).toBeGreaterThanOrEqual(8);
    });
  });

  it('rotates the key after a send, so the next announcement is not treated as a retry', async () => {
    const { getByRole, container } = mount();
    const input = subjectInput(container);
    await fireEvent.update(input, 'First');
    await fireEvent.click(getByRole('button', { name: /Send to participants/ }));
    await fireEvent.click(getByRole('button', { name: /Yes, send it/ }));
    await waitFor(() => expect(toasts.some((t) => t.kind === 'success')).toBe(true));
    const firstKey = calls.find((c) => c.opts?.method === 'POST' && c.url.endsWith('/announcements'))!.opts!.body!.idempotencyKey;

    await fireEvent.update(input, 'Second');
    await fireEvent.click(getByRole('button', { name: /Send to participants/ }));
    await fireEvent.click(getByRole('button', { name: /Yes, send it/ }));
    await waitFor(() => {
      const sends = calls.filter((c) => c.opts?.method === 'POST' && c.url.endsWith('/announcements'));
      expect(sends).toHaveLength(2);
      expect(sends[1]!.opts!.body!.idempotencyKey).not.toBe(firstKey);
    });
  });

  it('tells the organizer nobody was double-mailed when the server reports a duplicate', async () => {
    installGlobals({ onSend: () => ({ announcementId: 'a1', recipientCount: 7, duplicate: true }) });
    const { getByRole, container } = mount();
    await fireEvent.update(subjectInput(container), 'An update');
    await fireEvent.click(getByRole('button', { name: /Send to participants/ }));
    await fireEvent.click(getByRole('button', { name: /Yes, send it/ }));

    await waitFor(() => expect(toasts.some((t) => /already sent/i.test(t.msg))).toBe(true));
    expect(toasts.some((t) => t.kind === 'success')).toBe(false);
  });

  it('cannot send with an empty subject', async () => {
    const { getByRole } = mount();
    await nextTick();
    expect((getByRole('button', { name: /Send to participants/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('cannot send with an empty body', async () => {
    const { getByRole, container } = mount();
    await fireEvent.update(subjectInput(container), 'An update');
    await nextTick();
    // With the seeded starter body it is sendable...
    expect((getByRole('button', { name: /Send to participants/ }) as HTMLButtonElement).disabled).toBe(false);
    // ...and deleting every block takes it back off.
    editorBlocks.value = [];
    await nextTick();
    expect((getByRole('button', { name: /Send to participants/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  // On an instance with email delivery off the outbox worker never drains, so a
  // "sent" announcement would sit queued forever. The send route refuses with a
  // 409; the composer must say so BEFORE an organizer writes the whole email.
  it('refuses to send, and says why, when email delivery is off on the instance', async () => {
    installGlobals({ delivery: false });
    editorBlocks.value = [['paragraph', { text: 'hi' }]];
    const { getByRole, getByText, container } = mount();
    await fireEvent.update(subjectInput(container), 'An update');
    await nextTick();

    expect(getByText(/Email delivery is turned off on this instance/i)).toBeTruthy();
    expect((getByRole('button', { name: /Send to participants/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  // The preview is a real email rendered by the server. Rendering it with v-html
  // would execute organizer-authored markup in the editor's own origin.
  it('renders the preview in a sandboxed iframe, never with v-html', async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy());
    const frame = container.querySelector('iframe')!;
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.getAttribute('srcdoc')).toContain('preview');
  });

  it('has no axe violations', async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy());
    // `iframes: false`: the preview frame is a sandboxed srcdoc, and jsdom cannot
    // let axe reach into it ("Respondable target must be a frame in the current
    // window"). The frame's contents are a server-rendered email, not this page.
    const results = await axe.run(container, { rules: { region: { enabled: false } }, iframes: false });
    expect(results.violations).toEqual([]);
  });
});
