import type { ModuleMeta } from '../types';

const meta: ModuleMeta = {
  id: 'reveal-cards',
  name: 'Reveal Cards',
  description: 'Click-to-flip card grid for test-yourself moments',
  icon: 'fa-clone',
  color: '#8b5cf6',
  category: 'display',
  contentFields: {
    heading: true,
    body: true,
    insight: true,
    bridge: true,
    aside: true,
  },
};

export default meta;
