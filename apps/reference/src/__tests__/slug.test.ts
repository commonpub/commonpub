import { describe, it, expect, vi } from 'vitest';
import { generateSlug } from '../lib/utils/slug';

describe('generateSlug', () => {
  it('should convert a simple title to a slug', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('should handle multiple spaces and special characters', () => {
    expect(generateSlug('My   Amazing -- Project!')).toBe('my-amazing-project');
  });

  it('should strip diacritics from unicode characters', () => {
    expect(generateSlug('Résumé über Naïve')).toBe('resume-uber-naive');
  });

  it('should handle numbers in the title', () => {
    expect(generateSlug('ESP32 LED Matrix v2')).toBe('esp32-led-matrix-v2');
  });

  it('should return empty string for empty input', () => {
    expect(generateSlug('')).toBe('');
  });

  it('should handle strings with only special characters', () => {
    expect(generateSlug('!!!@@@###')).toBe('');
  });

  it('should trim leading and trailing hyphens', () => {
    expect(generateSlug('  --Hello--  ')).toBe('hello');
  });

  it('should handle CJK and emoji by removing them', () => {
    expect(generateSlug('Hello 世界 🌍')).toBe('hello');
  });
});
