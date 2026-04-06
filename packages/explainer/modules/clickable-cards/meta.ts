import type { ModuleMeta } from '../types';

const meta: ModuleMeta = {
  id: 'clickable-cards',
  name: 'Expandable Cards',
  description: 'Card grid with expandable detail panels for taxonomies',
  icon: 'fa-th-large',
  color: '#10b981',
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
