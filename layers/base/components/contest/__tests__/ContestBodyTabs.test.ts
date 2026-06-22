import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import ContestBodyTabs from '../ContestBodyTabs.vue';

// Stub the inner block editor (its internals are covered by ContestBodyEditor.test);
// this focuses on the tab structure + switching.
const stubs = {
  ContestBodyEditor: {
    props: ['modelValue', 'legacy', 'legacyFormat', 'mode'],
    template: '<div class="cpub-contest-body-editor" :data-mode="mode" />',
  },
};

describe('ContestBodyTabs', () => {
  it('renders Overview/Rules/Prizes tabs with a body editor each', () => {
    const { getByRole, container } = render(ContestBodyTabs, {
      props: { description: [['heading', { text: 'X', level: 2 }]] },
      global: { stubs },
    });
    expect(getByRole('tab', { name: /Overview/ })).toBeTruthy();
    expect(getByRole('tab', { name: /Rules/ })).toBeTruthy();
    expect(getByRole('tab', { name: /Prizes/ })).toBeTruthy();
    // All three stay mounted (v-show) so block state survives tab switches.
    expect(container.querySelectorAll('.cpub-contest-body-editor').length).toBe(3);
  });

  it('switches the active tab on click (aria-selected)', async () => {
    const { getByRole } = render(ContestBodyTabs, { props: {}, global: { stubs } });
    const overview = getByRole('tab', { name: /Overview/ });
    const rules = getByRole('tab', { name: /Rules/ });
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(rules.getAttribute('aria-selected')).toBe('false');
    await fireEvent.click(rules);
    expect(rules.getAttribute('aria-selected')).toBe('true');
    expect(overview.getAttribute('aria-selected')).toBe('false');
  });

  it('has only the body tabs by default (no extra tabs)', () => {
    const { queryByRole } = render(ContestBodyTabs, { props: {}, global: { stubs } });
    expect(queryByRole('tab', { name: /Stages/ })).toBeNull();
    expect(queryByRole('tab', { name: /Judging/ })).toBeNull();
  });

  it('shows a Write/Preview/Code switch on body tabs and forwards the mode to every editor', async () => {
    const { getByRole, container } = render(ContestBodyTabs, { props: {}, global: { stubs } });
    const writeBtn = getByRole('button', { name: /Write/ });
    const previewBtn = getByRole('button', { name: /Preview/ });
    expect(writeBtn.getAttribute('aria-pressed')).toBe('true');
    expect(previewBtn.getAttribute('aria-pressed')).toBe('false');
    const editors = () => Array.from(container.querySelectorAll('.cpub-contest-body-editor'));
    expect(editors().length).toBe(3);
    editors().forEach((e) => expect(e.getAttribute('data-mode')).toBe('write'));
    await fireEvent.click(previewBtn);
    expect(previewBtn.getAttribute('aria-pressed')).toBe('true');
    expect(writeBtn.getAttribute('aria-pressed')).toBe('false');
    editors().forEach((e) => expect(e.getAttribute('data-mode')).toBe('preview'));
  });

  it('hides the mode switch on extra (non-body) tabs', async () => {
    const { getByRole, queryByRole } = render(ContestBodyTabs, {
      props: { extraTabs: [{ key: 'stages', label: 'Stages', icon: 'fa-diagram-project' }] },
      slots: { stages: '<div>STAGES</div>' },
      global: { stubs },
    });
    expect(getByRole('button', { name: /Preview/ })).toBeTruthy();
    await fireEvent.click(getByRole('tab', { name: /Stages/ }));
    expect(queryByRole('button', { name: /Preview/ })).toBeNull();
    // Returning to a body tab brings the switch back.
    await fireEvent.click(getByRole('tab', { name: /Overview/ }));
    expect(getByRole('button', { name: /Preview/ })).toBeTruthy();
  });

  it('renders extraTabs as canvas tabs, each from its named slot', async () => {
    const { getByRole, getByText } = render(ContestBodyTabs, {
      props: {
        extraTabs: [
          { key: 'stages', label: 'Stages', icon: 'fa-diagram-project' },
          { key: 'judging', label: 'Judging', icon: 'fa-scale-balanced' },
        ],
      },
      slots: { stages: '<div>STAGES PANEL</div>', judging: '<div>JUDGING PANEL</div>' },
      global: { stubs },
    });
    const stagesTab = getByRole('tab', { name: /Stages/ });
    const judgingTab = getByRole('tab', { name: /Judging/ });
    expect(stagesTab).toBeTruthy();
    expect(judgingTab).toBeTruthy();
    expect(getByText('STAGES PANEL')).toBeTruthy();
    expect(getByText('JUDGING PANEL')).toBeTruthy();
    await fireEvent.click(judgingTab);
    expect(judgingTab.getAttribute('aria-selected')).toBe('true');
    expect(stagesTab.getAttribute('aria-selected')).toBe('false');
  });
});
