import type { ConfigField } from '../types';

const config: ConfigField[] = [
  {
    key: 'cards', title: 'Cards', type: 'array', default: [],
    group: 'Cards',
    itemTemplate: { title: '', icon: '', description: '', detail: '' },
  },
];

export default config;
