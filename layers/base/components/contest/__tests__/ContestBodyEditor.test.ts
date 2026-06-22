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

describe('ContestBodyEditor (smoke)', () => {
  it('mounts a BlockCanvas (seeded from modelValue) without throwing', () => {
    const { container } = render(ContestBodyEditor, {
      props: { modelValue: [['heading', { text: 'Mission', level: 2 }]] },
    });
    expect(container.querySelector('.cpub-contest-body-editor')).toBeTruthy();
  });

  it('mounts when seeding from legacy markdown', () => {
    const { container } = render(ContestBodyEditor, {
      props: { modelValue: null, legacy: '# Hi\n\nBody', legacyFormat: 'markdown' },
    });
    expect(container.querySelector('.cpub-contest-body-editor')).toBeTruthy();
  });
});
