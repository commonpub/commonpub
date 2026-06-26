/**
 * Component test for the admin Email Branding editor (email Phase 2).
 * Lives under components/__tests__ (bracket-free) so packaging excludes it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { ref } from 'vue';
import EmailTemplatesPage from '../../pages/admin/email-templates.vue';

const $fetch = vi.fn(async (url: string, _opts?: unknown) => (String(url).includes('preview') ? { html: '<p>preview</p>' } : { ok: true }));
const toast = { success: vi.fn(), error: vi.fn() };
let loaded: Record<string, string> | null = { accentColor: '#123456', headerText: 'Acme' };

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useToast: () => toast,
  useFetch: () => ({ data: ref(loaded) }),
  $fetch,
});

beforeEach(() => {
  $fetch.mockClear();
  toast.success.mockClear();
  toast.error.mockClear();
  loaded = { accentColor: '#123456', headerText: 'Acme' };
});

describe('admin email branding editor', () => {
  it('hydrates the form from the loaded branding and renders a live preview', async () => {
    const { container, findByTitle } = render(EmailTemplatesPage);
    const accent = container.querySelector('#eb-accent') as HTMLInputElement;
    expect(accent.value).toBe('#123456');
    expect((container.querySelector('#eb-header') as HTMLInputElement).value).toBe('Acme');
    // onMounted fetches the server-rendered preview into the iframe.
    const frame = await findByTitle('Email preview');
    expect(frame.getAttribute('srcdoc')).toContain('preview');
    expect($fetch).toHaveBeenCalledWith('/api/admin/email-preview', expect.objectContaining({ method: 'POST' }));
  });

  it('saves only non-empty fields via PUT', async () => {
    const { getByText } = render(EmailTemplatesPage);
    await fireEvent.click(getByText('Save branding'));
    expect($fetch).toHaveBeenCalledWith('/api/admin/email-branding', expect.objectContaining({
      method: 'PUT',
      body: { accentColor: '#123456', headerText: 'Acme' },
    }));
    expect(toast.success).toHaveBeenCalled();
  });

  it('disables save (no PUT) on an invalid accent color', async () => {
    loaded = { accentColor: 'notacolor' };
    const { getByText, container } = render(EmailTemplatesPage);
    const btn = getByText('Save branding') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(container.querySelector('.cpub-eb-err')).toBeTruthy(); // inline validation message shown
    await fireEvent.click(btn); // disabled → no-op
    const putCalls = $fetch.mock.calls.filter((c) => String(c[0]).includes('email-branding') && (c[1] as { method?: string })?.method === 'PUT');
    expect(putCalls).toHaveLength(0);
  });
});
