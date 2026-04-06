import type { ModuleMeta } from '../types';

const meta: ModuleMeta = {
  id: 'compare',
  name: 'Do / Don\'t Compare',
  description: 'Side-by-side best practices comparison',
  icon: 'fa-columns',
  color: '#14b8a6',
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
