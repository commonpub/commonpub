import type { ConfigField } from '../types';

const config: ConfigField[] = [
  { key: 'doTitle', title: 'Do Column Title', type: 'text', default: 'Do', group: 'Labels' },
  { key: 'dontTitle', title: 'Don\'t Column Title', type: 'text', default: 'Don\'t', group: 'Labels' },
  { key: 'doItems', title: 'Do Items', type: 'array', default: [], group: 'Good Practices' },
  { key: 'dontItems', title: 'Don\'t Items', type: 'array', default: [], group: 'Bad Practices' },
];

export default config;
