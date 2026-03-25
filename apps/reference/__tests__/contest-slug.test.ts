import { describe, it, expect } from 'vitest';

// Extracted from server/api/contests/index.post.ts for testability
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128);
}

describe('contest slug generation', () => {
  it('generates slug from normal title', () => {
    expect(slugify('Edge AI Challenge 2026')).toBe('edge-ai-challenge-2026');
  });

  it('handles special characters', () => {
    expect(slugify('Win a Raspberry Pi 5!')).toBe('win-a-raspberry-pi-5');
  });

  it('collapses multiple spaces and dashes', () => {
    expect(slugify('foo   bar---baz')).toBe('foo-bar-baz');
  });

  it('strips leading and trailing dashes', () => {
    expect(slugify('---hello---')).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });

  it('returns empty string for only special chars', () => {
    expect(slugify('!!??@@')).toBe('');
  });

  it('truncates to 128 characters', () => {
    const long = 'a'.repeat(200);
    expect(slugify(long).length).toBe(128);
  });

  it('handles unicode/emoji by stripping them', () => {
    expect(slugify('Build AI 🤖 Projects')).toBe('build-ai-projects');
  });
});
