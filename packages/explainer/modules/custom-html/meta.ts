import type { ModuleMeta } from '../types';

const meta: ModuleMeta = {
  id: 'custom-html',
  name: 'Custom HTML/JS',
  description: 'Raw HTML, CSS, and JavaScript in a sandboxed iframe',
  icon: 'fa-code',
  color: '#84cc16',
  category: 'custom',
  contentFields: {
    heading: true,
    body: true,
    insight: true,
    bridge: true,
    aside: true,
  },
};

export default meta;
