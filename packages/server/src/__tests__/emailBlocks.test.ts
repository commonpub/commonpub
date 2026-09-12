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

  it('decodes TipTap entities so html-backed text is escaped exactly once (no double-escape)', () => {
    // The block editor emits `<p>Q&amp;A &lt;3 &quot;hi&quot;</p>` for the typed text `Q&A <3 "hi"`.
    const { html, text } = renderEmailBlocks([['paragraph', { html: '<p>Q&amp;A &lt;3 &quot;hi&quot;</p>' }]]);
    expect(text).toBe('Q&A <3 "hi"');
    expect(html).toContain('Q&amp;A &lt;3 &quot;hi&quot;');
    expect(html).not.toContain('&amp;amp;');
    expect(html).not.toContain('&amp;lt;');
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

  it('makes the registrationLink CTA ABSOLUTE against siteUrl (no https://auth/register)', () => {
    // Regression: the CTA shipped as a bare `/auth/register`. An email has no
    // document base, so a mail client prepending the scheme produced
    // `https:///auth/register` → normalized to the host `auth`. Both MIME parts
    // must carry the absolute URL.
    const { html, text } = renderEmailBlocks(
      [['registrationLink', { label: 'Enter now', ref: 'abc' }]],
      { siteUrl: 'https://deveco.io' },
    );
    expect(html).toContain('<a href="https://deveco.io/auth/register?ref=abc"');
    expect(text).toContain('Enter now: https://deveco.io/auth/register?ref=abc');
    expect(html).not.toContain('href="/auth/register');
  });

  it('retargets a blank CTA at registrationUrl (contest page), not the account-signup page', () => {
    // Everyone who receives a contest email already has an account and is already
    // registered, so `/auth/register` is a dead end for them.
    const { html, text } = renderEmailBlocks([['registrationLink', { label: 'Your registration' }]], {
      siteUrl: 'https://deveco.io',
      registrationUrl: 'https://deveco.io/contests/resilient/register',
    });
    expect(html).toContain('href="https://deveco.io/contests/resilient/register"');
    expect(html).not.toContain('/auth/register');
    expect(text).toContain('Your registration: https://deveco.io/contests/resilient/register');
  });

  it('registrationUrl does not override an explicitly authored url', () => {
    const { html } = renderEmailBlocks([['registrationLink', { url: 'https://partner.example/join' }]], {
      siteUrl: 'https://deveco.io',
      registrationUrl: 'https://deveco.io/contests/resilient/register',
    });
    expect(html).toContain('href="https://partner.example/join"');
  });

  it('leaves an organizer-supplied absolute CTA url alone, and still blocks unsafe ones', () => {
    const abs = renderEmailBlocks([['registrationLink', { url: 'https://partner.example/join' }]], {
      siteUrl: 'https://deveco.io',
    });
    expect(abs.html).toContain('href="https://partner.example/join"');
    const unsafe = renderEmailBlocks([['registrationLink', { url: 'javascript:alert(1)' }]], {
      siteUrl: 'https://deveco.io',
    });
    expect(unsafe.html).not.toContain('javascript:');
    expect(unsafe.html).toContain('href="https://deveco.io/auth/register"');
  });

  it('resolves an instance-hosted (root-relative) image against siteUrl, drops it without one', () => {
    const withSite = renderEmailBlocks([['image', { src: '/uploads/a.png', alt: 'A' }]], {
      siteUrl: 'https://deveco.io',
    });
    expect(withSite.html).toContain('<img src="https://deveco.io/uploads/a.png"');
    // No origin to resolve against ⇒ dropped rather than emitted un-fetchable.
    const without = renderEmailBlocks([['image', { src: '/uploads/a.png', alt: 'A' }]]);
    expect(without.html).toBe('');
    // A protocol-relative (off-site) src is NOT an instance path — still dropped,
    // never rewritten into a bogus local URL.
    for (const src of ['//evil.example/x.png', '/\\evil.example/x.png']) {
      expect(renderEmailBlocks([['image', { src }]], { siteUrl: 'https://deveco.io' }).html).toBe('');
    }
  });

  it('only allows http(s) images, and reads the editor `src` field as well as `url`', () => {
    const ok = renderEmailBlocks([['image', { url: 'https://cdn.example.com/a.png', alt: 'A' }]]);
    expect(ok.html).toContain('<img src="https://cdn.example.com/a.png"');
    // ImageBlock (the block editor) writes `src`, not `url`.
    const srcImg = renderEmailBlocks([['image', { src: 'https://cdn.example.com/b.png', alt: 'B' }]]);
    expect(srcImg.html).toContain('<img src="https://cdn.example.com/b.png"');
    const bad = renderEmailBlocks([['image', { url: 'javascript:alert(1)' }]]);
    expect(bad.html).toBe('');
    const badSrc = renderEmailBlocks([['image', { src: 'javascript:alert(1)' }]]);
    expect(badSrc.html).toBe('');
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

// --- Inline formatting (session 260) -------------------------------------
//
// `renderEmailBlocks` used to reduce every html-bearing block to its bare text.
// That was not a formatting nicety: a bullet list collapsed to
// `A laptopA power strip` (no separator at all), `<br>` vanished, and an
// organizer's hyperlink lost its href in BOTH MIME parts, so a line reading
// "Email the organizers" arrived with the address nowhere in the message.
// Strikethrough was worse than lossy: `Deadline is <s>Friday</s> Monday`
// arrived as "Deadline is Friday Monday", which inverts the meaning.
//
// The block editor loads Bold, Italic, Code, Strike, Link, BulletList and
// OrderedList, so an organizer can author every one of these, and the editor
// showed them correctly while the preview and the send silently dropped them.
//
// The output vocabulary is CLOSED: nothing is ever copied from the input. The
// input is parsed, and only tags this renderer writes itself are emitted, each
// with its own inline styles. That is what keeps the security guarantees below
// true no matter what the input contains.

describe('renderEmailBlocks — inline formatting is preserved', () => {
  const html = (b: unknown) => renderEmailBlocks(b).html;
  const text = (b: unknown) => renderEmailBlocks(b).text;
  const para = (h: string) => [['paragraph', { html: h }]];

  it('keeps bold and italic', () => {
    const out = html(para('<p>Kickoff is <strong>Monday</strong> and <em>early</em>.</p>'));
    expect(out).toContain('<strong>Monday</strong>');
    expect(out).toContain('<em>early</em>');
  });

  it('keeps a hyperlink with its href, and carries the URL into the text part', () => {
    const b = para('<p>Read the <a href="https://x.test/rules">rules</a>.</p>');
    expect(html(b)).toContain('href="https://x.test/rules"');
    expect(html(b)).toContain('>rules</a>');
    // The text part must not lose the address — that is how "email the
    // organizers" used to arrive with no address anywhere in the message.
    expect(text(b)).toContain('https://x.test/rules');
  });

  it('keeps a mailto link', () => {
    const b = para('<p>Email <a href="mailto:org@x.test">the organizers</a>.</p>');
    expect(html(b)).toContain('href="mailto:org@x.test"');
    expect(text(b)).toContain('mailto:org@x.test');
  });

  it('renders a bullet list as a real list, never run-together words', () => {
    const out = html(para('<ul><li><p>A laptop</p></li><li><p>A power strip</p></li></ul>'));
    expect(out).toContain('<ul');
    expect(out).toContain('A laptop');
    expect(out).toContain('A power strip');
    expect(out).not.toContain('A laptopA power strip');
  });

  it('renders an ordered list, and the text part uses separate lines', () => {
    const b = para('<ol><li><p>Register</p></li><li><p>Submit</p></li></ol>');
    expect(html(b)).toContain('<ol');
    expect(text(b)).toMatch(/Register[\s\S]*Submit/);
    expect(text(b)).not.toContain('RegisterSubmit');
  });

  it('keeps line breaks', () => {
    const b = para('<p>Line one<br>Line two</p>');
    expect(html(b)).toContain('<br');
    expect(text(b)).not.toContain('Line oneLine two');
  });

  it('keeps strikethrough, which used to invert the meaning of a changed date', () => {
    const out = html(para('<p>Deadline is <s>Friday</s> Monday.</p>'));
    expect(out).toMatch(/<s>Friday<\/s>|line-through/);
  });

  it('keeps inline code', () => {
    expect(html(para('<p>Run <code>npm install</code>.</p>'))).toContain('npm install');
    expect(html(para('<p>Run <code>npm install</code>.</p>'))).toContain('<code');
  });

  it('keeps several top-level nodes in ONE block as separate paragraphs', () => {
    // A paste puts <p>..</p><ul>..</ul><p>..</p> inside a single TextBlock.
    const out = html(para('<p>First.</p><ul><li><p>Item</p></li></ul><p>Last.</p>'));
    expect(out).toContain('First.');
    expect(out).toContain('Last.');
    expect(out).not.toContain('First.Item');
    expect(out).not.toContain('ItemLast.');
  });
});

describe('renderEmailBlocks — the security guarantees still hold', () => {
  const html = (h: string) => renderEmailBlocks([['paragraph', { html: h }]]).html;

  it('still drops an img with an event handler (the original pinned case)', () => {
    const out = html('<b>hi</b><img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('onerror');
    expect(out).toContain('hi');
  });

  it('never emits a script, and shows its text escaped instead', () => {
    const out = html('<script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toMatch(/<script/i);
  });

  it('drops a javascript: href but keeps the words', () => {
    const out = html('<p>See <a href="javascript:alert(1)">this</a>.</p>');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('this');
  });

  it('drops an entity-encoded javascript: href (the 8-encodings lesson)', () => {
    for (const h of ['java&#115;cript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)']) {
      const out = html(`<p><a href="${h}">x</a></p>`);
      expect(out.toLowerCase(), h).not.toContain('javascript');
    }
  });

  it('drops a data: href', () => {
    expect(html('<p><a href="data:text/html,<script>alert(1)</script>">x</a></p>')).not.toContain('data:');
  });

  it('strips every attribute it does not write itself (no style/onclick passthrough)', () => {
    const out = html('<p style="position:fixed" onclick="alert(1)" class="evil">hi</p>');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('position:fixed');
    expect(out).not.toContain('class="evil"');
    expect(out).toContain('hi');
  });

  it('emits nothing dangerous from an iframe, object or form', () => {
    for (const tag of ['iframe', 'object', 'form', 'style', 'link', 'meta']) {
      const out = html(`<${tag}>x</${tag}>`);
      expect(out.toLowerCase(), tag).not.toContain(`<${tag}`);
    }
  });

  // NESTED inside a paragraph, not just at the top level. The block-level and
  // inline walkers each have their own drop check, and only the block one was
  // covered until a surviving mutant said so.
  it('drops a dangerous element nested INSIDE a paragraph, content and all', () => {
    expect(html('<p>See <script>alert(1)</script> here</p>')).not.toContain('alert(1)');
    expect(html('<p>Hi <iframe src="https://evil.test"></iframe> there</p>')).not.toContain('evil.test');
    const img = html('<p>A <img src=x onerror=alert(1)> B</p>');
    expect(img).not.toContain('<img');
    expect(img).not.toContain('onerror');
  });

  // An http(s) URL passes the scheme check and STILL must be escaped: a quote in
  // the path would otherwise close the attribute and let an event handler in.
  it('escapes the href so a quote in the URL cannot break out of the attribute', () => {
    const out = html('<p><a href=\'https://x.test/"onmouseover="alert(1)\'>x</a></p>');
    expect(out).not.toContain('onmouseover="alert(1)"');
    expect(out).not.toMatch(/href="[^"]*"[^>]*onmouseover/);
    expect(out).toContain('&quot;');
  });

  // Cleaning the href is what lets a padded-but-legitimate URL through; the
  // scheme check already fails closed on anything it does not recognise.
  it('accepts a link whose href is padded with whitespace', () => {
    expect(html('<p><a href="  https://x.test/ok ">link</a></p>')).toContain('href="https://x.test/ok"');
  });

  it('normalises unbalanced input rather than emitting unbalanced tags', () => {
    const out = html('<p>a <strong>unclosed</p><li>orphan');
    const opens = (out.match(/<strong>/g) ?? []).length;
    const closes = (out.match(/<\/strong>/g) ?? []).length;
    expect(opens).toBe(closes);
  });

  it('still escapes a token value so it cannot inject markup', () => {
    const out = renderEmailBlocks([['paragraph', { html: '<p>Hi {name}</p>' }]], {
      tokens: { name: '<img src=x onerror=alert(1)>' },
    }).html;
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });
});
