import type { ConfigField } from '../types';

const config: ConfigField[] = [
  { key: 'question', title: 'Question', type: 'textarea', default: '', placeholder: 'What is...?', group: 'Quiz' },
  { key: 'options', title: 'Answer Options', type: 'array', default: [], group: 'Quiz' },
];

export default config;
