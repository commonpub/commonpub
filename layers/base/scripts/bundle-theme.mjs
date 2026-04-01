/**
 * Copies theme CSS from packages/ui/theme/ into layers/base/theme/
 * so the published npm package is self-contained.
 */
import { cpSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../../../packages/ui/theme');
const dest = resolve(__dirname, '../theme');

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

console.log(`Bundled theme CSS from ${src} → ${dest}`);
