import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import ContestBodyTabs from '../ContestBodyTabs.vue';

// Stub the inner block editor (its internals are covered by ContestBodyEditor.test);
// this focuses on the tab structure + switching.
const stubs = {
  ContestBodyEditor: {
    props: ['modelValue', 'legacy', 'legacyFormat'],
    template: '<div class="cpub-contest-body-editor" />',
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

  it('has no Stages tab by default', () => {
    const { queryByRole } = render(ContestBodyTabs, { props: {}, global: { stubs } });
    expect(queryByRole('tab', { name: /Stages/ })).toBeNull();
  });

  it('adds a Stages canvas tab (hasStages) rendering the #stages slot', async () => {
    const { getByRole, getByText } = render(ContestBodyTabs, {
      props: { hasStages: true },
      slots: { stages: '<div>STAGES PANEL</div>' },
      global: { stubs },
    });
    const stagesTab = getByRole('tab', { name: /Stages/ });
    expect(stagesTab).toBeTruthy();
    expect(getByText('STAGES PANEL')).toBeTruthy(); // slot content present (v-show)
    await fireEvent.click(stagesTab);
    expect(stagesTab.getAttribute('aria-selected')).toBe('true');
  });
});
