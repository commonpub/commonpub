/**
 * Round-trip tests for theme import/export — focused on the session-192
 * addition: a theme's `recipe` + `fonts` must survive export → import so a
 * Studio theme can be moved between instances without losing its wizard
 * state or its Google-Font set.
 */
import { describe, it, expect } from 'vitest';
import { buildExportFile, parseExportFile } from '../themeIO';
import type { CustomThemeRecord } from '../../types/theme';

const recipe = {
  mode: 'dark' as const,
  accent: '#34d9a0',
  scheme: 'analogous' as const,
  fonts: { display: 'Fraunces', body: 'Inter', ui: 'Space Mono', code: 'JetBrains Mono' },
  baseSize: 16,
  ratio: 1.25,
  spaceBase: 4 as const,
  density: 'balanced' as const,
  shapeRadius: 6,
  borderWidth: 2,
  shadowStyle: 'soft' as const,
  motion: 'snappy' as const,
  texture: 0,
};

function makeTheme(overrides: Partial<CustomThemeRecord> = {}): CustomThemeRecord {
  return {
    id: 'studio-theme',
    name: 'Studio Theme',
    description: 'Made with Studio',
    family: 'custom',
    isDark: true,
    parentTheme: 'dark',
    tokens: { accent: '#34d9a0', bg: '#0c0e0d' },
    recipe,
    fonts: ['Fraunces', 'Inter', 'Space Mono', 'JetBrains Mono'],
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('theme export/import round-trip', () => {
  it('preserves recipe + fonts through buildExportFile → parseExportFile', () => {
    const original = makeTheme();
    const { content, filename } = buildExportFile(original);
    expect(filename).toBe('studio-theme.cpub-theme.json');

    const parsed = parseExportFile(content);
    expect(parsed.recipe).toEqual(recipe);
    expect(parsed.fonts).toEqual(['Fraunces', 'Inter', 'Space Mono', 'JetBrains Mono']);
    expect(parsed.tokens).toEqual(original.tokens);
    expect(parsed.parentTheme).toBe('dark');
  });

  it('a hand-authored theme (no recipe/fonts) imports cleanly with both undefined', () => {
    const original = makeTheme({ recipe: undefined, fonts: undefined });
    const parsed = parseExportFile(buildExportFile(original).content);
    expect(parsed.recipe).toBeUndefined();
    expect(parsed.fonts).toBeUndefined();
  });

  it('drops non-string entries from a tampered fonts array', () => {
    const original = makeTheme();
    const body = JSON.parse(buildExportFile(original).content);
    body.theme.fonts = ['Inter', 42, null, 'Fraunces'];
    const parsed = parseExportFile(JSON.stringify(body));
    expect(parsed.fonts).toEqual(['Inter', 'Fraunces']);
  });

  it('ignores a non-array fonts value defensively', () => {
    const original = makeTheme();
    const body = JSON.parse(buildExportFile(original).content);
    body.theme.fonts = 'Inter';
    const parsed = parseExportFile(JSON.stringify(body));
    expect(parsed.fonts).toBeUndefined();
  });
});
