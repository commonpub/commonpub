import type { ConfigField } from '../types';

const config: ConfigField[] = [
  { key: 'labelA', title: 'Mode A Label', type: 'text', default: 'Mode A', group: 'Modes' },
  { key: 'labelB', title: 'Mode B Label', type: 'text', default: 'Mode B', group: 'Modes' },
  { key: 'descriptionA', title: 'Mode A Description', type: 'textarea', default: '', group: 'Content' },
  { key: 'descriptionB', title: 'Mode B Description', type: 'textarea', default: '', group: 'Content' },
  { key: 'defaultMode', title: 'Default Mode', type: 'select', default: 'A', options: [{ value: 'A', label: 'Mode A' }, { value: 'B', label: 'Mode B' }], group: 'Modes' },
];

export default config;
