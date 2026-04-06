import type { ModuleMeta } from '../types';

const meta: ModuleMeta = {
  id: 'toggle',
  name: 'Toggle Compare',
  description: 'Binary A/B comparison with two states',
  icon: 'fa-toggle-on',
  color: '#3b82f6',
  category: 'input',
  contentFields: {
    heading: true,
    body: true,
    insight: true,
    bridge: true,
    aside: true,
  },
};

export default meta;
