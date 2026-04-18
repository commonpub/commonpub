import { describe, it, expect } from 'vitest';
import { highlightSnippet } from '../../../layers/base/utils/highlightSnippet';

describe('highlightSnippet', () => {
  it('restores <b>...</b> tokens emitted by ts_headline', () => {
    const out = highlightSnippet('Install <b>redis</b> for rate limiting');
    expect(out).toBe('Install <b>redis</b> for rate limiting');
  });

  it('handles multiple matches in one snippet', () => {
    const out = highlightSnippet('<b>foo</b> then <b>bar</b>');
    expect(out).toBe('<b>foo</b> then <b>bar</b>');
  });

  it('escapes any other HTML the source might contain', () => {
    // ts_headline should never emit this, but defense in depth.
    const out = highlightSnippet('<script>alert(1)</script>');
    expect(out).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes attributes on a <b> tag (only bare tags allowed through)', () => {
    const out = highlightSnippet('<b class="evil" onclick="alert(1)">x</b>');
    expect(out).toBe('&lt;b class=&quot;evil&quot; onclick=&quot;alert(1)&quot;&gt;x</b>');
  });

  it('escapes ampersands and quotes', () => {
    const out = highlightSnippet('a & b "c" \'d\'');
    expect(out).toBe('a &amp; b &quot;c&quot; &#39;d&#39;');
  });

  it('returns empty string for empty/null/undefined input', () => {
    expect(highlightSnippet('')).toBe('');
    expect(highlightSnippet(null)).toBe('');
    expect(highlightSnippet(undefined)).toBe('');
  });

  it('preserves text with lone angle brackets', () => {
    const out = highlightSnippet('threshold < 10 and > 5');
    expect(out).toBe('threshold &lt; 10 and &gt; 5');
  });
});
