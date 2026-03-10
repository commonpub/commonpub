import { describe, it, expect } from 'vitest';
import {
  textContentSchema,
  headingContentSchema,
  codeContentSchema,
  imageContentSchema,
  quoteContentSchema,
  calloutContentSchema,
} from '../blocks/schemas';

describe('Block Content Schemas', () => {
  describe('textContentSchema', () => {
    it('accepts valid text content', () => {
      const result = textContentSchema.safeParse({ html: '<p>Hello world</p>' });
      expect(result.success).toBe(true);
    });

    it('rejects missing html', () => {
      const result = textContentSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects non-string html', () => {
      const result = textContentSchema.safeParse({ html: 123 });
      expect(result.success).toBe(false);
    });
  });

  describe('headingContentSchema', () => {
    it('accepts valid heading content', () => {
      const result = headingContentSchema.safeParse({ text: 'Title', level: 2 });
      expect(result.success).toBe(true);
    });

    it('accepts level 1-4', () => {
      for (const level of [1, 2, 3, 4]) {
        expect(headingContentSchema.safeParse({ text: 'T', level }).success).toBe(true);
      }
    });

    it('rejects level 5', () => {
      const result = headingContentSchema.safeParse({ text: 'T', level: 5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing text', () => {
      const result = headingContentSchema.safeParse({ level: 1 });
      expect(result.success).toBe(false);
    });
  });

  describe('codeContentSchema', () => {
    it('accepts valid code content', () => {
      const result = codeContentSchema.safeParse({
        code: 'console.log("hi")',
        language: 'typescript',
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional filename', () => {
      const result = codeContentSchema.safeParse({
        code: 'fn main() {}',
        language: 'rust',
        filename: 'main.rs',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filename).toBe('main.rs');
      }
    });

    it('rejects missing language', () => {
      const result = codeContentSchema.safeParse({ code: 'hello' });
      expect(result.success).toBe(false);
    });
  });

  describe('imageContentSchema', () => {
    it('accepts valid image content', () => {
      const result = imageContentSchema.safeParse({
        src: 'https://example.com/img.png',
        alt: 'Example image',
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional caption', () => {
      const result = imageContentSchema.safeParse({
        src: 'https://example.com/img.png',
        alt: 'Example',
        caption: 'A photo',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid URL', () => {
      const result = imageContentSchema.safeParse({
        src: 'not-a-url',
        alt: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing alt', () => {
      const result = imageContentSchema.safeParse({
        src: 'https://example.com/img.png',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('quoteContentSchema', () => {
    it('accepts valid quote content', () => {
      const result = quoteContentSchema.safeParse({
        html: '<p>To be or not to be</p>',
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional attribution', () => {
      const result = quoteContentSchema.safeParse({
        html: '<p>Quote</p>',
        attribution: 'Shakespeare',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('calloutContentSchema', () => {
    it('accepts valid callout content', () => {
      const result = calloutContentSchema.safeParse({
        html: '<p>Note this</p>',
        variant: 'info',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all variants', () => {
      for (const variant of ['info', 'tip', 'warning', 'danger']) {
        expect(
          calloutContentSchema.safeParse({ html: '<p>X</p>', variant }).success
        ).toBe(true);
      }
    });

    it('rejects invalid variant', () => {
      const result = calloutContentSchema.safeParse({
        html: '<p>X</p>',
        variant: 'error',
      });
      expect(result.success).toBe(false);
    });
  });
});
