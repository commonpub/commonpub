import { parseHTML } from 'linkedom';
import { absolutizeHref, buildRegistrationHref, registrationLabel, registrationVariant } from '@commonpub/editor';

/**
 * Render a BlockTuple[] email body (from the per-contest block editor) to an
 * EMAIL-SAFE HTML subset + a plain-text fallback.
 *
 * Design constraints:
 *  - Email clients support only a narrow, inline-styled HTML subset — no external
 *    CSS, scripts, or most interactive elements. We render a curated subset
 *    (text, heading, quote, callout, image, divider, registrationLink) and DROP
 *    everything else (video/quiz/slider/gallery/embed/…) rather than emit markup
 *    that would break or leak in a mail client.
 *  - All text is HTML-escaped; a block carrying `html` is reduced to its text
 *    (tags stripped) before escaping — so no organizer markup reaches the wire
 *    unsanitized (the block editor's authors are privileged, but email injection
 *    / phishing is still guarded here, the single render choke point).
 *  - Image + link URLs are restricted to http(s) (+ the shared registration-href
 *    guard), so no `javascript:`/`data:` smuggling.
 *  - Every URL is made ABSOLUTE against the instance's `siteUrl`. An email has no
 *    document base, so a root-relative `/auth/register` (the registration block's
 *    default) is not merely ugly — a mail client that prepends the scheme yields
 *    `https:///auth/register`, which URL-normalizes to the host `auth`. ALWAYS pass
 *    `siteUrl` from a send path.
 */

const DEFAULT_ACCENT = '#5b9cf6';
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const HTTP = /^https?:\/\//i;
/** Callout colours. Both are set explicitly: the callout used to set only a
 *  near-white background and inherit the shell's light text, which measured
 *  1.24:1 -- effectively invisible. */
const CALLOUT_BG = '#eef4ff';
const CALLOUT_FG = '#1a2230';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

/** Decode the HTML entities the block editor (TipTap getHTML) emits, so the
 *  downstream esc() escapes the text exactly ONCE (else `Q&A` typed in a block
 *  becomes `Q&amp;A` in the sent email). `&amp;` is decoded LAST so a literal
 *  `&amp;lt;` becomes `&lt;`, not `<`. */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Replace `{token}` placeholders from a value map. Applied to raw text BEFORE
 *  escaping, so a token value is itself HTML-escaped downstream (safe). Unknown
 *  tokens are left verbatim (mirrors the legacy intro tokenizer). */
function interpolate(s: string, tokens?: Record<string, string>): string {
  if (!tokens) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => tokens[k] ?? m);
}

/** Best-effort plain text from a block's content, regardless of exact shape.
 *  html/content are TipTap output (tags + entities) → strip tags + decode
 *  entities to raw text; the caller re-escapes exactly once. */
function blockText(content: Record<string, unknown>): string {
  if (typeof content.text === 'string') return content.text;
  if (typeof content.html === 'string') return decodeEntities(stripTags(content.html));
  if (typeof content.content === 'string') return decodeEntities(stripTags(content.content));
  return '';
}

/**
 * Rich-text rendering for a block that carries authored HTML.
 *
 * The renderer used to reduce such a block to its bare text. That destroyed
 * every hyperlink's href (in BOTH MIME parts, so "email the organizers" arrived
 * with no address anywhere), collapsed `<ul><li>a</li><li>b</li></ul>` to the
 * run-together string `ab`, dropped `<br>`, and turned `Deadline is
 * <s>Friday</s> Monday` into "Deadline is Friday Monday" -- which inverts the
 * meaning rather than merely losing a style.
 *
 * THE SECURITY MODEL IS UNCHANGED IN STRENGTH, and is worth stating because it
 * is easy to read this as "we now pass author HTML through". We do not. The
 * output vocabulary is CLOSED: the input is parsed into a DOM, and the only
 * markup ever emitted is markup this module writes itself, with attributes it
 * constructs. Nothing is copied from the input except text, which is escaped.
 * So an attribute, a tag or an encoding this file does not know about cannot
 * reach the wire -- there is no filter to defeat.
 *
 * Parsing (rather than a regex) also removes the tag-balancing hazard: a regex
 * allowlist cannot close `<strong>unclosed`, and unbalanced markup in an email
 * relocates content in the client. linkedom normalises it for us.
 */

/** Schemes a link may use. Anything else keeps its words and loses its href. */
const SAFE_SCHEME = /^(?:https?:|mailto:)/i;

/** Elements whose TEXT must not be shown either -- their content is code or
 *  chrome, not prose. Everything else unknown is unwrapped to its children. */
const DROP_CONTENT = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON',
  'SELECT', 'TEXTAREA', 'SVG', 'MATH', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META',
  'LINK', 'TITLE', 'BASE', 'AUDIO', 'VIDEO', 'CANVAS', 'IMG',
]);

/** Resolve a link, or null to drop it. Control characters and whitespace are
 *  removed FIRST so `java\tscript:` and ` javascript:` cannot slip past; the
 *  parser has already decoded entities, so `java&#115;cript:` arrives decoded.
 *  A root-relative href is absolutized -- an email has no document base. */
function safeLinkHref(raw: string | null, siteUrl?: string): string | null {
  // Strip control characters, NBSP and line/paragraph separators by code point
  // rather than with a control-character regex: `no-control-regex` exists to
  // catch accidental ones, and suppressing it on a security check is the wrong
  // trade. This also catches DEL (0x7f), which the regex form missed.
  const cleaned = Array.from(raw ?? '')
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp > 0x20 && cp !== 0x7f && cp !== 0xa0 && cp !== 0x2028 && cp !== 0x2029;
    })
    .join('');
  if (!cleaned) return null;
  const abs = cleaned.startsWith('/') && !/^\/[/\\]/.test(cleaned) ? absolutizeHref(cleaned, siteUrl) : cleaned;
  return SAFE_SCHEME.test(abs) ? abs : null;
}

/** The minimal DOM surface this renderer walks. linkedom's own node types are
 *  structurally compatible; naming just what we touch keeps the walker honest
 *  about how little of the DOM it depends on, and avoids an `any`. */
interface DomNode {
  nodeType: number;
  textContent: string | null;
  childNodes: ArrayLike<DomNode>;
  tagName?: string;
  getAttribute?(name: string): string | null;
}

interface RichCtx {
  accent: string;
  siteUrl?: string;
  tok: (s: string) => string;
}

/** Depth cap: pathological nesting must not become unbounded recursion. */
const MAX_DEPTH = 20;

/** Render inline content. Returns html (escaped text + our own tags) and the
 *  plain-text counterpart, which carries link URLs so the text part is not a
 *  lesser message than the html one. */
function renderInline(node: DomNode, ctx: RichCtx, depth = 0): RenderedEmailBody {
  let html = '';
  let text = '';
  if (depth > MAX_DEPTH) return { html, text };
  for (const el of Array.from(node.childNodes)) {
    if (el.nodeType === 3) {
      const t = ctx.tok(el.textContent ?? '');
      html += esc(t);
      text += t;
      continue;
    }
    if (el.nodeType !== 1) continue;
    const tag = String(el.tagName ?? '').toUpperCase();
    if (DROP_CONTENT.has(tag)) continue;
    if (tag === 'BR') { html += '<br />'; text += '\n'; continue; }
    const inner = renderInline(el, ctx, depth + 1);
    switch (tag) {
      case 'STRONG': case 'B':
        html += `<strong>${inner.html}</strong>`; text += inner.text; break;
      case 'EM': case 'I':
        html += `<em>${inner.html}</em>`; text += inner.text; break;
      case 'S': case 'DEL': case 'STRIKE':
        html += `<s>${inner.html}</s>`; text += inner.text; break;
      case 'U':
        html += `<u>${inner.html}</u>`; text += inner.text; break;
      case 'CODE':
        html += `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.95em;">${inner.html}</code>`;
        text += inner.text; break;
      case 'A': {
        const href = safeLinkHref(el.getAttribute?.('href') ?? null, ctx.siteUrl);
        if (!href) { html += inner.html; text += inner.text; break; }
        html += `<a href="${esc(href)}" style="color:${ctx.accent};text-decoration:underline;">${inner.html}</a>`;
        // The URL in the text part too: losing it there is how a line reading
        // "email the organizers" arrived with the address nowhere in the mail.
        text += inner.text === href ? inner.text : `${inner.text} (${href})`;
        break;
      }
      default:
        // Unknown but harmless (span, div, font, ...) -- unwrap to its children.
        html += inner.html; text += inner.text; break;
    }
  }
  return { html, text };
}

/** Flatten a block's authored HTML to INLINE content only, for containers that
 *  are themselves a single styled box (quote, callout). Keeps bold/links; does
 *  not nest block elements inside the box. */
function renderInlineFromHtml(rawHtml: string, ctx: RichCtx): RenderedEmailBody {
  const { document } = parseHTML(`<!doctype html><html><body>${rawHtml}</body></html>`);
  const body = document.body as unknown as DomNode | null;
  return body ? renderInline(body, ctx) : { html: '', text: '' };
}

/** Render a block's authored HTML as block-level email content. */
function renderRich(rawHtml: string, ctx: RichCtx): RenderedEmailBody {
  const { document } = parseHTML(`<!doctype html><html><body>${rawHtml}</body></html>`);
  const body = document.body as unknown as DomNode | null;
  if (!body) return { html: '', text: '' };
  const htmlParts: string[] = [];
  const textParts: string[] = [];
  const pushInline = (inner: RenderedEmailBody, wrap: (h: string) => string): void => {
    if (!inner.html.trim() && !inner.text.trim()) return;
    htmlParts.push(wrap(inner.html));
    if (inner.text.trim()) textParts.push(inner.text.trim());
  };

  for (const el of Array.from(body.childNodes)) {
    if (el.nodeType === 3) {
      const t = ctx.tok(el.textContent ?? '').trim();
      if (t) { htmlParts.push(`<p style="margin:0 0 16px;line-height:1.6;">${esc(t)}</p>`); textParts.push(t); }
      continue;
    }
    if (el.nodeType !== 1) continue;
    const tag = String(el.tagName ?? '').toUpperCase();
    if (DROP_CONTENT.has(tag)) continue;

    switch (tag) {
      case 'P':
        pushInline(renderInline(el, ctx), (h) => `<p style="margin:0 0 16px;line-height:1.6;">${h}</p>`);
        break;
      case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': {
        const small = tag !== 'H1' && tag !== 'H2';
        pushInline(renderInline(el, ctx), (h) =>
          `<h${small ? 3 : 2} style="margin:0 0 12px;font-size:${small ? '18px' : '22px'};line-height:1.3;">${h}</h${small ? 3 : 2}>`);
        break;
      }
      case 'BLOCKQUOTE':
        pushInline(renderInline(el, ctx), (h) =>
          `<blockquote style="margin:0 0 16px;padding:8px 16px;border-left:3px solid ${ctx.accent};">${h}</blockquote>`);
        break;
      case 'UL': case 'OL': {
        const ordered = tag === 'OL';
        const items: string[] = [];
        let n = 0;
        for (const li of Array.from(el.childNodes)) {
          if (li.nodeType !== 1) continue;
          if (String(li.tagName ?? '').toUpperCase() !== 'LI') continue;
          // TipTap wraps each item's content in a <p>; unwrap so the item is not
          // a block inside a block.
          const kids = Array.from(li.childNodes).filter(
            (k) => k.nodeType === 1 || (k.textContent ?? '').trim(),
          );
          const src = kids.length === 1 && kids[0]!.nodeType === 1
            && String(kids[0]!.tagName ?? '').toUpperCase() === 'P'
            ? kids[0]!
            : li;
          const inner = renderInline(src, ctx);
          if (!inner.html.trim() && !inner.text.trim()) continue;
          n += 1;
          items.push(`<li style="margin:0 0 6px;">${inner.html}</li>`);
          textParts.push(`${ordered ? `${n}.` : '-'} ${inner.text.trim()}`);
        }
        if (items.length) {
          htmlParts.push(
            `<${ordered ? 'ol' : 'ul'} style="margin:0 0 16px;padding-left:24px;line-height:1.6;">${items.join('')}</${ordered ? 'ol' : 'ul'}>`,
          );
        }
        break;
      }
      case 'HR':
        htmlParts.push('<hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />');
        break;
      case 'BR':
        break;
      default: {
        // Unknown block-ish element: keep its content rather than its wrapper.
        pushInline(renderInline(el, ctx), (h) => `<p style="margin:0 0 16px;line-height:1.6;">${h}</p>`);
        break;
      }
    }
  }
  return { html: htmlParts.join('\n'), text: textParts.join('\n\n') };
}

export interface RenderedEmailBody {
  html: string;
  text: string;
}

export interface RenderEmailBlocksOptions {
  /** Accent color for CTA buttons / quote bars (from instance branding). */
  accent?: string;
  /** `{token}` values interpolated into text content (e.g. username, contestTitle,
   *  deadline) — parity with the legacy `intro` tokenizer. */
  tokens?: Record<string, string>;
  /** The instance's public origin (`https://example.org`). Root-relative block URLs
   *  are resolved against it — REQUIRED for a real send, since an email has no base
   *  URL (see the module note). Omitted ⇒ URLs are emitted as authored. */
  siteUrl?: string;
  /** Where a registration-link block with NO explicit URL should point. The block's
   *  own default is the instance account-signup page, which is a dead end in a
   *  participation email — the recipient necessarily has an account already. Contest
   *  sends pass that contest's registration page. Omitted ⇒ the block's own default. */
  registrationUrl?: string;
}

/**
 * Convert a stored/posted email body (BlockTuple[]) into `{ html, text }`.
 * Accepts `unknown` and tolerates malformed input (returns what it can render),
 * so a corrupt block never crashes a send.
 */
export function renderEmailBlocks(blocks: unknown, opts?: RenderEmailBlocksOptions): RenderedEmailBody {
  const accent = opts?.accent && HEX.test(opts.accent) ? opts.accent : DEFAULT_ACCENT;
  const tokens = opts?.tokens;
  const siteUrl = opts?.siteUrl;
  const tok = (s: string): string => interpolate(s, tokens);
  const richCtx: RichCtx = { accent, siteUrl, tok };
  /** Authored HTML for a block, if it carries any. A block with a plain `text`
   *  field has no markup to preserve and takes the simple path below. */
  const authoredHtml = (c: Record<string, unknown>): string | null => {
    if (typeof c.text === 'string') return null;
    if (typeof c.html === 'string' && c.html.trim()) return c.html;
    if (typeof c.content === 'string' && c.content.trim()) return c.content;
    return null;
  };
  const list = Array.isArray(blocks) ? blocks : [];
  const htmlParts: string[] = [];
  const textParts: string[] = [];

  for (const raw of list) {
    if (!Array.isArray(raw) || raw.length < 1 || typeof raw[0] !== 'string') continue;
    const type = raw[0];
    const content = (raw[1] && typeof raw[1] === 'object' ? raw[1] : {}) as Record<string, unknown>;

    switch (type) {
      case 'text':
      case 'paragraph': {
        const authored = authoredHtml(content);
        if (authored !== null) {
          // Rich path: bold, italics, links, lists and line breaks survive.
          const r = renderRich(authored, richCtx);
          if (r.html) htmlParts.push(r.html);
          if (r.text) textParts.push(r.text);
          break;
        }
        const t = tok(blockText(content).trim());
        if (!t) break;
        htmlParts.push(`<p style="margin:0 0 16px;line-height:1.6;">${esc(t)}</p>`);
        textParts.push(t);
        break;
      }
      case 'heading':
      case 'sectionHeader': {
        const t = tok(blockText(content).trim());
        if (!t) break;
        const level = content.level === 3 || content.level === '3' ? 3 : 2;
        const size = level === 3 ? '18px' : '22px';
        htmlParts.push(`<h${level} style="margin:0 0 12px;font-size:${size};line-height:1.3;">${esc(t)}</h${level}>`);
        textParts.push(t);
        break;
      }
      case 'quote':
      case 'blockquote': {
        const authored = authoredHtml(content);
        if (authored !== null) {
          const r = renderInlineFromHtml(authored, richCtx);
          if (r.html.trim()) {
            htmlParts.push(`<blockquote style="margin:0 0 16px;padding:8px 16px;border-left:3px solid ${accent};">${r.html}</blockquote>`);
            if (r.text.trim()) textParts.push(`"${r.text.trim()}"`);
          }
          break;
        }
        const t = tok(blockText(content).trim());
        if (!t) break;
        htmlParts.push(
          `<blockquote style="margin:0 0 16px;padding:8px 16px;border-left:3px solid ${accent};">${esc(t)}</blockquote>`,
        );
        textParts.push(`"${t}"`);
        break;
      }
      case 'callout': {
        const authored = authoredHtml(content);
        if (authored !== null) {
          const r = renderInlineFromHtml(authored, richCtx);
          if (r.html.trim()) {
            htmlParts.push(`<div style="margin:0 0 16px;padding:12px 16px;border:1px solid ${accent};background:${CALLOUT_BG};color:${CALLOUT_FG};">${r.html}</div>`);
            if (r.text.trim()) textParts.push(r.text.trim());
          }
          break;
        }
        const t = tok(blockText(content).trim());
        if (!t) break;
        htmlParts.push(
          `<div style="margin:0 0 16px;padding:12px 16px;border:1px solid ${accent};background:${CALLOUT_BG};color:${CALLOUT_FG};">${esc(t)}</div>`,
        );
        textParts.push(t);
        break;
      }
      case 'image': {
        // The block editor's ImageBlock writes `src`; older/AP content uses `url`.
        const raw =
          (typeof content.url === 'string' && content.url) ? content.url
          : typeof content.src === 'string' ? content.src : '';
        // An instance-hosted image is stored root-relative (`/uploads/…`), which no
        // mail client can fetch — resolve it against siteUrl. Anything that is still
        // not http(s) after that (a `data:`/`javascript:` smuggle, or a relative src
        // with no siteUrl to resolve it) is dropped rather than emitted broken.
        // `//host/x` (and its `/\host` backslash variant) is an OFF-SITE target, not
        // an instance path — resolving it against siteUrl would invent a bogus local
        // URL. Leave those to the http(s) check below, which drops them.
        const url = raw.startsWith('/') && !/^\/[/\\]/.test(raw) ? absolutizeHref(raw, siteUrl) : raw;
        if (!HTTP.test(url)) break;
        const alt = typeof content.alt === 'string' ? content.alt : '';
        htmlParts.push(
          `<p style="margin:0 0 16px;"><img src="${esc(url)}" alt="${esc(alt)}" style="max-width:100%;height:auto;" /></p>`,
        );
        if (alt) textParts.push(`[image: ${alt}]`);
        break;
      }
      case 'divider':
      case 'horizontal_rule':
      case 'horizontalRule': {
        htmlParts.push('<hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />');
        break;
      }
      case 'registrationLink': {
        // Absolute, always: a relative href in an email resolves to a bogus host
        // (see module note). `registrationUrl` also replaces the block's own
        // account-signup default, which is a dead end for a recipient who by
        // definition already has an account.
        const href = absolutizeHref(
          buildRegistrationHref(content, { fallbackUrl: opts?.registrationUrl }),
          siteUrl,
        );
        const label = registrationLabel(content);
        const secondary = registrationVariant(content) === 'secondary';
        const bg = secondary ? '#ffffff' : accent;
        const color = secondary ? accent : '#ffffff';
        htmlParts.push(
          `<p style="margin:20px 0;text-align:center;"><a href="${esc(href)}" style="display:inline-block;padding:12px 28px;background:${bg};color:${color};text-decoration:none;border:2px solid ${accent};font-weight:600;">${esc(label)}</a></p>`,
        );
        textParts.push(`${label}: ${href}`);
        break;
      }
      default:
        // Unknown / email-unsafe block types are intentionally dropped.
        break;
    }
  }

  return { html: htmlParts.join('\n'), text: textParts.join('\n\n') };
}
