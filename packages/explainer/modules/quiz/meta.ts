import type { ModuleMeta } from '../types';

const meta: ModuleMeta = {
  id: 'quiz',
  name: 'Knowledge Check',
  description: 'Multiple choice with answer feedback',
  icon: 'fa-circle-question',
  color: '#8b5cf6',
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
