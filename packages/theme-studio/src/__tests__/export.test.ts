import { describe, it, expect } from 'vitest';
import { buildBrief, buildTokensJson } from '../export.js';
import { recipeToTokens, defaultRecipe } from '../index.js';

const { tokens } = recipeToTokens({ ...defaultRecipe(), accent: '#2f6fed' });

describe('buildBrief', () => {
  it('produces a markdown brief with the key token values', () => {
    const md = buildBrief({ name: 'Kiln', description: 'Workshop theme' }, tokens);
    expect(md).toContain('# Kiln — CommonPub theme');
    expect(md).toContain('Workshop theme');
    expect(md).toContain('--accent | ' + tokens['accent']);
    expect(md).toContain('--secondary |');
    expect(md).toContain('## Typography');
  });
});

describe('buildTokensJson', () => {
  it('emits DTCG-style JSON splitting colors from other tokens', () => {
    const json = JSON.parse(buildTokensJson({ name: 'Kiln' }, tokens));
    expect(json.color.accent).toEqual({ $value: tokens['accent'], $type: 'color' });
    // A length token lands under `token`, not `color`.
    expect(json.token['text-base'].$value).toBe(tokens['text-base']);
    expect(json.color['text-base']).toBeUndefined();
  });
});
