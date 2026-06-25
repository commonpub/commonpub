/**
 * Component tests for ContestProposalForm (Phase 4 form-first proposal entry).
 *
 * Locks: template-driven field rendering, the form-instructions blocks rendered
 * ABOVE the fields (`instructionsBlocks`), the required-field gate, the POST
 * payload + 'submitted' emit, and an axe scan.
 *
 * Uses Nuxt auto-imports (useToast, useApiError, $fetch) the layer harness
 * doesn't provide — stub them on globalThis. BlocksBlockContentRenderer is an
 * auto-imported component; stub it so the intro render is observable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import ContestProposalForm from '../ContestProposalForm.vue';
import ContestSubmissionField from '../ContestSubmissionField.vue';
import type { ContestStage } from '@commonpub/schema';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const fetchMock = vi.fn(() => Promise.resolve({ entryId: 'e1', projectSlug: 'my-build', contentType: 'project' }));

Object.assign(globalThis, {
  useToast: () => ({ success: toastSuccess, error: toastError }),
  useApiError: () => ({ extract: (e: unknown) => String(e) }),
  $fetch: fetchMock,
});

const STAGE: ContestStage = {
  id: 'proposals',
  name: 'Proposals',
  kind: 'submission',
  description: 'Pitch your idea.',
  submissionTemplate: [
    { key: 'project_name', label: 'Project name', type: 'text', required: true },
    { key: 'pitch', label: 'One-line pitch', type: 'textarea', required: false },
  ],
};

const introStub = { props: ['blocks'], template: '<div class="intro-stub" :data-count="blocks.length" />' };

function mount(stage: ContestStage = STAGE) {
  return render(ContestProposalForm, {
    props: { contestSlug: 'resilient', stage },
    global: { components: { ContestSubmissionField }, stubs: { BlocksBlockContentRenderer: introStub } },
  });
}

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  fetchMock.mockClear();
});

describe('ContestProposalForm — rendering', () => {
  it('renders one input per template field', () => {
    const { container } = mount();
    expect(container.querySelector('#cpub-proposal-project_name')).toBeTruthy();
    expect(container.querySelector('#cpub-proposal-pitch')).toBeTruthy();
  });

  it('renders nothing when the stage has no submission template', () => {
    const { container } = mount({ ...STAGE, submissionTemplate: [] });
    expect(container.querySelector('.cpub-proposal')).toBeNull();
  });
});

describe('ContestProposalForm — instructions intro', () => {
  it('renders instructionsBlocks above the form fields', () => {
    const { container } = mount({ ...STAGE, instructionsBlocks: [['markdown', { content: 'Keep it short.' }]] });
    const intro = container.querySelector('.intro-stub');
    expect(intro).toBeTruthy();
    expect(intro?.getAttribute('data-count')).toBe('1');
    const firstField = container.querySelector('[id^="cpub-proposal-"]');
    expect(intro!.compareDocumentPosition(firstField!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('omits the intro when there are no instructionsBlocks', () => {
    const { container } = mount();
    expect(container.querySelector('.intro-stub')).toBeNull();
  });
});

describe('ContestProposalForm — submit', () => {
  it('POSTs the trimmed fields and emits submitted with the new project slug', async () => {
    const { container, emitted } = mount();
    await fireEvent.update(container.querySelector('#cpub-proposal-project_name')!, '  Solar Mesh  ');
    await fireEvent.click(container.querySelector('.cpub-btn-primary')!);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/contests/resilient/proposal',
      { method: 'POST', body: { stageId: 'proposals', fields: { project_name: 'Solar Mesh' } } },
    );
    expect(toastSuccess).toHaveBeenCalled();
    expect(emitted().submitted?.[0]).toEqual(['my-build', 'project']);
  });

  it('blocks the submit and explains when a required field is blank', async () => {
    const { container } = mount();
    await fireEvent.click(container.querySelector('.cpub-btn-primary')!);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Project name'));
  });
});

describe('ContestProposalForm — accessibility', () => {
  it('passes an axe scan', async () => {
    const { container } = mount({ ...STAGE, instructionsBlocks: [['markdown', { content: 'Hi' }]] });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
