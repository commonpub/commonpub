import type { ConfigField } from '../types';

const config: ConfigField[] = [
  { key: 'html', title: 'HTML', type: 'code', default: '<div id="widget">Hello</div>', group: 'Code' },
  { key: 'css', title: 'CSS', type: 'code', default: '', group: 'Code' },
  { key: 'js', title: 'JavaScript', type: 'code', default: '', group: 'Code' },
  { key: 'height', title: 'Container Height', type: 'number', default: 300, group: 'Layout' },
  { key: 'sandboxed', title: 'Run in iframe sandbox', type: 'toggle', default: true, group: 'Security' },
];

export default config;
