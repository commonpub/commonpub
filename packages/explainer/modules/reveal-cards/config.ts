import type { ConfigField } from '../types';

const config: ConfigField[] = [
  { key: 'columns', title: 'Columns', type: 'select', default: '3', options: [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }], group: 'Layout' },
  { key: 'cards', title: 'Cards', type: 'array', default: [], group: 'Cards' },
];

export default config;
