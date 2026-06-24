/**
 * Component tests for ContestStageSubmission (per-stage artifact form).
 *
 * Locks: template-driven rendering (text/textarea/url inputs + required marks +
 * help text), pre-filling from an existing artifact, the PUT payload shape
 * (only non-blank trimmed fields), the eliminated-entry guard, the multi-entry
 * picker, dirty-gating on the save button, and an axe scan.
 *
 * Uses Nuxt auto-imports (useToast, useApiError, $fetch) the layer test
 * harness doesn't provide — stub them on globalThis before rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/vue';
import axe from 'axe-core';
import ContestStageSubmission from '../ContestStageSubmission.vue';
import ContestSubmissionField from '../ContestSubmissionField.vue';
import type { ContestStage } from '@commonpub/schema';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const fetchMock = vi.fn(() => Promise.resolve({ submitted: true, stageSubmissions: [] }));

Object.assign(globalThis, {
  useToast: () => ({ success: toastSuccess, error: toastError }),
  useApiError: () => ({ extract: (e: unknown) => String(e) }),
  $fetch: fetchMock,
});

const STAGE: ContestStage = {
  id: 'proto',
  name: 'Prototype',
  kind: 'submission',
  description: 'Ship your working prototype.',
  submissionTemplate: [
    { key: 'repo_url', label: 'Repository URL', type: 'url', required: true, help: 'A public git repository.' },
    { key: 'summary', label: 'Build summary', type: 'textarea', required: false },
    { key: 'team_name', label: 'Team name', type: 'text', required: false },
  ],
};

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    contentTitle: 'Solar Mesh Node',
    eliminated: false,
    stageSubmissions: [],
    ...overrides,
  };
}

function mount(props: Record<string, unknown> = {}) {
  return render(ContestStageSubmission, {
    props: { contestSlug: 'resilient', stage: STAGE, entries: [makeEntry()], ...props },
    global: { components: { ContestSubmissionField } },
  });
}

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  fetchMock.mockClear();
});

describe('ContestStageSubmission — rendering', () => {
  it('renders one input per template field with the right control types', () => {
    const { container } = mount();
    expect(container.querySelector('input#cpub-stagesub-repo_url')?.getAttribute('type')).toBe('url');
    expect(container.querySelector('textarea#cpub-stagesub-summary')).toBeTruthy();
    expect(container.querySelector('input#cpub-stagesub-team_name')?.getAttribute('type')).toBe('text');
  });

  it('marks required fields and shows help text', () => {
    const { container } = mount();
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.includes('Repository URL'));
    expect(label?.textContent).toContain('*');
    expect(container.textContent).toContain('A public git repository.');
  });

  it('shows the not-submitted badge, then the submitted badge when an artifact exists', () => {
    const { container } = mount();
    expect(container.textContent).toContain('Not submitted yet');

    // Two mounts in one test: tear the first down so the duplicate `id-prefix`
    // ids (cpub-stagesub-*) don't collide in document.body and shadow the second
    // form's inputs (otherwise the second `querySelector` resolves to null).
    cleanup();
    const { container: done } = mount({
      entries: [makeEntry({
        stageSubmissions: [{ stageId: 'proto', fields: { repo_url: 'https://github.com/x/y' }, submittedAt: '2026-06-01T12:00:00.000Z' }],
      })],
    });
    expect(done.textContent).toContain('Submitted');
    expect((done.querySelector('#cpub-stagesub-repo_url') as HTMLInputElement).value).toBe('https://github.com/x/y');
  });

  it('renders nothing when every entry is eliminated (cohort gate, client side)', () => {
    const { container } = mount({ entries: [makeEntry({ eliminated: true })] });
    expect(container.querySelector('.cpub-stagesub')).toBeNull();
  });

  it('offers an entry picker only when the entrant has several live entries', () => {
    const { container: one } = mount();
    expect(one.querySelector('#cpub-stagesub-entry')).toBeNull();

    const { container: two } = mount({
      entries: [makeEntry(), makeEntry({ id: '00000000-0000-4000-8000-000000000002', contentTitle: 'Backup Rig' })],
    });
    expect(two.querySelector('#cpub-stagesub-entry')).toBeTruthy();
    expect(two.textContent).toContain('Backup Rig');
  });
});

describe('ContestStageSubmission — saving', () => {
  it('PUTs only non-blank trimmed fields to the entry submission endpoint', async () => {
    const { container, emitted } = mount();
    await fireEvent.update(container.querySelector('#cpub-stagesub-repo_url')!, '  https://github.com/x/y  ');
    await fireEvent.update(container.querySelector('#cpub-stagesub-summary')!, 'Works offline.');
    // team_name left blank ⇒ omitted from the payload.
    await fireEvent.click(container.querySelector('.cpub-btn-primary')!);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/contests/resilient/entries/00000000-0000-4000-8000-000000000001/submission',
      {
        method: 'PUT',
        body: { stageId: 'proto', fields: { repo_url: 'https://github.com/x/y', summary: 'Works offline.' } },
      },
    );
    expect(toastSuccess).toHaveBeenCalled();
    expect(emitted().saved).toBeTruthy();
  });

  it('blocks the save and explains when a required field is blank', async () => {
    const { container } = mount();
    await fireEvent.update(container.querySelector('#cpub-stagesub-summary')!, 'No repo yet.');
    await fireEvent.click(container.querySelector('.cpub-btn-primary')!);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Repository URL'));
  });

  it('disables the button until something changed', async () => {
    const { container } = mount();
    const btn = container.querySelector('.cpub-btn-primary') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await fireEvent.update(container.querySelector('#cpub-stagesub-repo_url')!, 'https://github.com/x/y');
    expect(btn.disabled).toBe(false);
  });
});

describe('ContestStageSubmission — accessibility', () => {
  it('passes an axe scan', async () => {
    const { container } = mount();
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
