import { describe, it, expect, vi } from 'vitest';
import { provide } from 'vue';
import { render } from '@testing-library/vue';
import { seedBodyBlocks } from '../../../utils/contestBody';

// Auto-imports the SFC relies on (test-setup globalizes computed/ref/watch; provide
// + the layer composable + the util are not, so stub them with the REAL provide/util).
Object.assign(globalThis, {
  provide,
  seedBodyBlocks,
  useFileUpload: () => ({ uploadFile: vi.fn(async () => ({ url: 'u' })) }),
});

// eslint-disable-next-line import/first
import ContestBodyEditor from '../ContestBodyEditor.vue';

// The view renderer is a Nuxt auto-import (absent in vitest) — Vue hoists its
// resolution even behind a falsy v-if, so stub it everywhere to keep output clean.
const RendererStub = { props: ['blocks'], template: '<div class="render-stub" :data-count="blocks.length" />' };
const stubs = { BlocksBlockContentRenderer: RendererStub };

describe('ContestBodyEditor (smoke)', () => {
  it('mounts a BlockCanvas (seeded from modelValue) without throwing', () => {
    const { container } = render(ContestBodyEditor, {
      props: { modelValue: [['heading', { text: 'Mission', level: 2 }]] },
      global: { stubs },
    });
    expect(container.querySelector('.cpub-contest-body-editor')).toBeTruthy();
  });

  it('mounts when seeding from legacy markdown', () => {
    const { container } = render(ContestBodyEditor, {
      props: { modelValue: null, legacy: '# Hi\n\nBody', legacyFormat: 'markdown' },
      global: { stubs },
    });
    expect(container.querySelector('.cpub-contest-body-editor')).toBeTruthy();
  });

  it('renders the view renderer with the live blocks in preview mode', () => {
    const { container } = render(ContestBodyEditor, {
      props: { modelValue: [['heading', { text: 'Hi', level: 2 }]], mode: 'preview' },
      global: { stubs },
    });
    const stub = container.querySelector('.render-stub');
    expect(stub).toBeTruthy();
    expect(stub?.getAttribute('data-count')).toBe('1');
  });

  it('renders read-only BlockTuple JSON in code mode', () => {
    const { container } = render(ContestBodyEditor, {
      props: { modelValue: [['heading', { text: 'Hi', level: 2 }]], mode: 'code' },
      global: { stubs },
    });
    const pre = container.querySelector('pre.cpub-cbe-code');
    expect(pre).toBeTruthy();
    expect(pre?.textContent).toContain('heading');
  });
});
