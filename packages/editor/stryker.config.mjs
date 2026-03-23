import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  appendPlugins: [
    join(rootDir, 'node_modules/@stryker-mutator/vitest-runner/dist/src/index.js'),
  ],
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  concurrency: 4,
  timeoutMS: 30000,
  mutate: [
    'src/serialization.ts',
    'src/blocks/schemas.ts',
    'src/blocks/registry.ts',
    'src/editorKit.ts',
  ],
};
