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

  it('strips HTML comments (e.g. a Markdown-import header) — never leaks raw <!--', () => {
    const out = markdownToExcerpt('<!-- ============================ -->\nThe Resilient America Challenge invites makers to build.');
    expect(out).not.toMatch(/<!--/);
    expect(out).toBe('The Resilient America Challenge invites makers to build.');
  });

  it('strips a multi-line HTML comment mid-content', () => {
    expect(markdownToExcerpt('Before\n<!-- hidden\nnotes\nhere -->\nAfter')).toBe('Before After');
  });

  it('strips an unterminated trailing HTML comment', () => {
    expect(markdownToExcerpt('Visible text <!-- dangling comment with no close')).toBe('Visible text');
  });

  it('drops a <style> block WITH its CSS content (Markdown-import artifact)', () => {
    const out = markdownToExcerpt('<style> .rac{ --rac-bg:var(--color-surface,#ffffff); color:red } </style>\nThe Challenge invites makers.');
    expect(out).not.toMatch(/<style|--rac-bg|color:red/);
    expect(out).toBe('The Challenge invites makers.');
  });

  it('drops an unterminated <style> block to end of input', () => {
    expect(markdownToExcerpt('Intro text <style> .x { color: red } and more css')).toBe('Intro text');
  });

  it('strips generic HTML tags but keeps their text', () => {
    expect(markdownToExcerpt('<div class="rac"><h2>Rules</h2><p>Build something &amp; ship it</p></div>'))
      .toBe('Rules Build something & ship it');
  });

  it('handles the real jinger-style header: comment + style + text', () => {
    const raw = '<!-- ===================== -->\n<style> .rac{ --rac-bg:var(--c,#fff) } </style>\nThe Resilient America Preparedness Challenge invites makers to build edge AI.';
    const out = markdownToExcerpt(raw);
    expect(out).not.toMatch(/<!--|<style|--rac-bg/);
    expect(out).toBe('The Resilient America Preparedness Challenge invites makers to build edge AI.');
  });

  it('never leaves a raw heading wall', () => {
    const out = markdownToExcerpt('# Rules\n\n## Eligibility\n\nAnyone may enter.');
    expect(out).not.toMatch(/#/);
    expect(out).toBe('Rules Eligibility Anyone may enter.');
  });
});
