import type { ModuleMeta } from '../types';

const meta: ModuleMeta = {
  id: 'text-only',
  name: 'Text Block',
  description: 'Text section with no interactive element',
  icon: 'fa-align-left',
  color: '#6b7280',
  category: 'layout',
  contentFields: {
    heading: true,
    body: true,
    insight: true,
    bridge: true,
    aside: true,
  },
};

export default meta;
