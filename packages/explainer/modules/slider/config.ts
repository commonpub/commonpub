import type { ConfigField } from '../types';

const config: ConfigField[] = [
  { key: 'label', title: 'Slider Label', type: 'text', default: 'Variable', placeholder: 'e.g., Amount, Rate, Distance', group: 'Slider' },
  { key: 'min', title: 'Minimum', type: 'number', default: 0, group: 'Slider', width: 'half' },
  { key: 'max', title: 'Maximum', type: 'number', default: 100, group: 'Slider', width: 'half' },
  { key: 'step', title: 'Step Size', type: 'number', default: 1, group: 'Slider', width: 'half' },
  { key: 'defaultValue', title: 'Default Value', type: 'number', default: 50, group: 'Slider', width: 'half' },
  { key: 'unit', title: 'Unit Suffix', type: 'text', default: '', placeholder: '%, px, ms', group: 'Slider' },
  {
    key: 'feedback', title: 'Feedback Ranges', type: 'array', default: [],
    group: 'Feedback',
    itemTemplate: { min: 0, max: 50, state: 'good', message: '' },
  },
];

export default config;
