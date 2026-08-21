/**
 * Tag balancing in `sanitizeRichHtml`.
 *
 * The sanitizer is a string transform, not a parser, so unbalanced author HTML
 * used to pass straight through into `v-html` — and the browser's parser then
 * repaired it by relocating nodes past the container, which on a server-rendered
 * page IS a hydration mismatch.
 *
 * Found live: a contest `rules` body stored at exactly the 50,000-character cap,
 * cut mid-tag, leaving three unclosed `<div>` and one unclosed `<p>`. Three
 * hydration mismatches on every load of that page; none on an otherwise identical
 * contest without the unbalanced body.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeRichHtml, sanitizeBlockHtml } from '../useSanitize';

/** Every open tag has a matching close, in order. */
function isBalanced(html: string): boolean {
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[2]!.toLowerCase();
    if (m[1]) {
      if (stack.pop() !== tag) return false;
    } else if (!m[3] && !VOID.has(tag)) {
      stack.push(tag);
    }
  }
  return stack.length === 0;
}

describe('sanitizeRichHtml — tag balancing', () => {
  it('closes a body truncated mid-tag', () => {
    // The live shape: cut inside a <p>, inside three open <div>s.
    const truncated = '<div class="a"><div class="b"><div class="c"><p>Our sole point of c';
    const out = sanitizeRichHtml(truncated);
    expect(isBalanced(out)).toBe(true);
    expect(out).toContain('Our sole point of c');
    expect(out.endsWith('</p></div></div></div>')).toBe(true);
  });

  it('drops a stray close tag rather than letting it close a wrapper above', () => {
    // Emitting this </div> would close the container the content is injected
    // into, hoisting everything after it out of the intended subtree.
    const out = sanitizeRichHtml('<p>one</p></div><p>two</p>');
    expect(out).toBe('<p>one</p><p>two</p>');
    expect(isBalanced(out)).toBe(true);
  });

  it('closes interleaved tags innermost-out instead of interleaving the output', () => {
    const out = sanitizeRichHtml('<div><span><em>x</div>after');
    expect(isBalanced(out)).toBe(true);
    expect(out).toBe('<div><span><em>x</em></span></div>after');
  });

  it('never pushes a void element onto the stack', () => {
    for (const v of ['<br>', '<hr>', '<img src="https://e.co/a.png">', '<br/>', '<wbr>']) {
      const out = sanitizeRichHtml(`<p>a${v}b</p>`);
      expect(isBalanced(out)).toBe(true);
      expect(out).not.toContain('</br>');
      expect(out).not.toContain('</img>');
    }
  });

  it('leaves already-balanced HTML byte-identical', () => {
    // The no-regression case: balancing must not rewrite healthy content.
    const good = '<div class="x"><h2>Title</h2><p>Body with <strong>bold</strong> and <a href="https://example.com">a link</a>.</p><ul><li>one</li><li>two</li></ul></div>';
    expect(sanitizeRichHtml(good)).toBe(good);
  });

  it('still strips what the allowlist strips, and balances what survives', () => {
    const out = sanitizeRichHtml('<div><script>alert(1)</script><p onclick="x()">hi</div>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onclick');
    expect(out).toContain('hi');
    expect(isBalanced(out)).toBe(true);
  });

  it('handles a self-closing SVG subtree without inventing closers', () => {
    const out = sanitizeRichHtml('<svg viewBox="0 0 1 1"><path d="M0 0" /><circle /></svg>');
    expect(isBalanced(out)).toBe(true);
    expect(out).toContain('</svg>');
  });

  it('is deterministic, which is what keeps server and client output identical', () => {
    const messy = '<section><div><p>a<div>b</section>trailing';
    expect(sanitizeRichHtml(messy)).toBe(sanitizeRichHtml(messy));
    expect(isBalanced(sanitizeRichHtml(messy))).toBe(true);
  });

  // `sanitizeBlockHtml` guards the surfaces that render REMOTE federated content
  // (federated hub posts, mirrored content). There the imbalance is not an
  // accident of truncation but something a remote instance can send deliberately.
  it('balances the block sanitizer too, so a remote post cannot escape its card', () => {
    const hostile = '<p>innocent</p></div></div><p>hoisted out of the card</p>';
    const out = sanitizeBlockHtml(hostile);
    expect(out).not.toContain('</div>');
    expect(out).toContain('hoisted out of the card');
    expect(isBalanced(out)).toBe(true);
  });

  it('closes an unterminated remote element', () => {
    const out = sanitizeBlockHtml('<blockquote><p>quote that never ends');
    expect(isBalanced(out)).toBe(true);
    expect(out.endsWith('</p></blockquote>')).toBe(true);
  });

  it('leaves balanced remote content byte-identical', () => {
    const good = '<p>Hello from <a href="https://remote.example/@x">@x</a></p>';
    expect(sanitizeBlockHtml(good)).toBe(good);
  });

  // Implied end tags. `<p>a<p>b` is legal HTML5 and the parser ends the first
  // paragraph at the second, so nesting them produces a stray `</p>` that the
  // parser answers with an EMPTY paragraph. Found by auditing this fix.
  describe('implied end tags', () => {
    it('does not nest a second <p> inside the first', () => {
      expect(sanitizeRichHtml('<p>one<p>two')).toBe('<p>one</p><p>two</p>');
    });

    it('closes an open <p> when a block element follows', () => {
      expect(sanitizeRichHtml('<p>lead<div>block</div>')).toBe('<p>lead</p><div>block</div>');
    });

    it('does not stack empty paragraphs for the truncated-rules shape', () => {
      // Three unclosed divs and an unclosed p, cut mid-word: the live case.
      const out = sanitizeRichHtml('<div><div><div><p>our sole point of c');
      expect(out).toBe('<div><div><div><p>our sole point of c</p></div></div></div>');
      expect(out.match(/<p>\s*<\/p>/g)).toBeNull();
    });

    it('handles list items and table cells the same way', () => {
      expect(sanitizeRichHtml('<ul><li>a<li>b</ul>')).toBe('<ul><li>a</li><li>b</li></ul>');
      expect(sanitizeRichHtml('<table><tr><td>a<td>b</table>'))
        .toBe('<table><tr><td>a</td><td>b</td></tr></table>');
    });

    it('still nests a <p> inside a block, which is real nesting', () => {
      expect(sanitizeRichHtml('<div><p>a</p></div>')).toBe('<div><p>a</p></div>');
    });
  });
});
