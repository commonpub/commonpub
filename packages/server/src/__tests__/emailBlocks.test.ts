import { describe, it, expect } from 'vitest';
import { renderEmailBlocks } from '../emailBlocks.js';

describe('renderEmailBlocks', () => {
  it('renders an empty/omitted body to empty strings', () => {
    expect(renderEmailBlocks([])).toEqual({ html: '', text: '' });
    expect(renderEmailBlocks(undefined)).toEqual({ html: '', text: '' });
    expect(renderEmailBlocks(null)).toEqual({ html: '', text: '' });
  });

  it('renders text/heading/quote/callout/divider as inline-styled email HTML', () => {
    const { html, text } = renderEmailBlocks([
      ['heading', { text: 'Welcome', level: 2 }],
      ['text', { text: 'Thanks for joining.' }],
      ['quote', { text: 'Be excellent.' }],
      ['callout', { text: 'Deadline is Friday.' }],
      ['divider', {}],
    ]);
    expect(html).toContain('<h2');
    expect(html).toContain('Welcome');
    expect(html).toContain('<p style=');
    expect(html).toContain('Thanks for joining.');
    expect(html).toContain('<blockquote');
    expect(html).toContain('<hr');
    expect(text).toContain('Welcome');
    expect(text).toContain('Thanks for joining.');
  });

  it('escapes HTML in text content (no injection from block text)', () => {
    const { html } = renderEmailBlocks([['text', { text: '<script>alert(1)</script>' }]]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('strips tags when a block carries html instead of plain text', () => {
    const { html, text } = renderEmailBlocks([['text', { html: '<b>hi</b><img src=x onerror=alert(1)>' }]]);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror');
    expect(text).toContain('hi');
  });

  it('renders a registrationLink block as a safe CTA anchor', () => {
    const { html, text } = renderEmailBlocks([
      ['registrationLink', { label: 'Enter now', url: '/auth/register', ref: 'abc' }],
    ]);
    expect(html).toContain('<a href="/auth/register?ref=abc"');
    expect(html).toContain('Enter now');
    expect(text).toContain('Enter now: /auth/register?ref=abc');
  });

  it('falls back to the register page for an unsafe registrationLink url', () => {
    const { html } = renderEmailBlocks([['registrationLink', { url: 'javascript:alert(1)', label: 'x' }]]);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('/auth/register');
  });

  it('only allows http(s) images', () => {
    const ok = renderEmailBlocks([['image', { url: 'https://cdn.example.com/a.png', alt: 'A' }]]);
    expect(ok.html).toContain('<img src="https://cdn.example.com/a.png"');
    const bad = renderEmailBlocks([['image', { url: 'javascript:alert(1)' }]]);
    expect(bad.html).toBe('');
  });

  it('drops unknown / email-unsafe block types (quiz, slider, video, etc.)', () => {
    const { html } = renderEmailBlocks([
      ['quiz', { question: 'q' }],
      ['interactiveSlider', {}],
      ['video', { url: 'https://youtube.com/x' }],
      ['text', { text: 'kept' }],
    ]);
    expect(html).toContain('kept');
    expect(html).not.toContain('quiz');
    expect(html).not.toContain('iframe');
  });

  it('interpolates {tokens} in text before escaping (values escaped, unknowns kept)', () => {
    const { html, text } = renderEmailBlocks(
      [['text', { text: 'Hi {username}, welcome to {contestTitle} {unknown}' }]],
      { tokens: { username: '<b>ada</b>', contestTitle: 'RoboCup' } },
    );
    expect(text).toContain('Hi <b>ada</b>, welcome to RoboCup {unknown}');
    // token value is HTML-escaped in the html output (no raw tag injected)
    expect(html).toContain('Hi &lt;b&gt;ada&lt;/b&gt;, welcome to RoboCup {unknown}');
    expect(html).not.toContain('<b>ada</b>');
  });

  it('ignores malformed tuples without throwing', () => {
    expect(() => renderEmailBlocks([null, 'x', [], ['text'], ['text', 'notobj'], 42] as unknown[])).not.toThrow();
    const { html } = renderEmailBlocks([['text', { text: 'safe' }], null, 'junk'] as unknown[]);
    expect(html).toContain('safe');
  });
});
