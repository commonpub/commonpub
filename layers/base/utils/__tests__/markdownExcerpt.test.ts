import { describe, expect, it } from 'vitest';
import { markdownToExcerpt } from '../markdownExcerpt';

describe('markdownToExcerpt', () => {
  it('returns empty string for empty / nullish input', () => {
    expect(markdownToExcerpt('')).toBe('');
    expect(markdownToExcerpt('   ')).toBe('');
    expect(markdownToExcerpt(null)).toBe('');
    expect(markdownToExcerpt(undefined)).toBe('');
  });

  it('strips heading markers', () => {
    expect(markdownToExcerpt('## Welcome\nBuild things')).toBe('Welcome Build things');
  });

  it('drops fenced code blocks entirely', () => {
    expect(markdownToExcerpt('Intro\n```js\nconst x = 1;\n```\nOutro')).toBe('Intro Outro');
  });

  it('unwraps inline code, bold, italic, strikethrough', () => {
    expect(markdownToExcerpt('Use `npm` to **build** and _ship_ ~~fast~~'))
      .toBe('Use npm to build and ship fast');
  });

  it('keeps link text, drops the URL', () => {
    expect(markdownToExcerpt('See [the docs](https://example.com/x) now'))
      .toBe('See the docs now');
  });

  it('removes images', () => {
    expect(markdownToExcerpt('Logo ![alt](https://example.com/a.png) here')).toBe('Logo here');
  });

  it('strips list and blockquote markers', () => {
    expect(markdownToExcerpt('- one\n- two\n> quoted')).toBe('one two quoted');
  });

  it('collapses whitespace to single spaces', () => {
    expect(markdownToExcerpt('a\n\n\nb     c')).toBe('a b c');
  });

  it('never leaves a raw heading wall', () => {
    const out = markdownToExcerpt('# Rules\n\n## Eligibility\n\nAnyone may enter.');
    expect(out).not.toMatch(/#/);
    expect(out).toBe('Rules Eligibility Anyone may enter.');
  });
});
