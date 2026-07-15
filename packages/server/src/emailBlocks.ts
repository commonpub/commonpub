import { buildRegistrationHref, registrationLabel, registrationVariant } from '@commonpub/editor';

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
 */

const DEFAULT_ACCENT = '#5b9cf6';
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const HTTP = /^https?:\/\//i;

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
}

/**
 * Convert a stored/posted email body (BlockTuple[]) into `{ html, text }`.
 * Accepts `unknown` and tolerates malformed input (returns what it can render),
 * so a corrupt block never crashes a send.
 */
export function renderEmailBlocks(blocks: unknown, opts?: RenderEmailBlocksOptions): RenderedEmailBody {
  const accent = opts?.accent && HEX.test(opts.accent) ? opts.accent : DEFAULT_ACCENT;
  const tokens = opts?.tokens;
  const tok = (s: string): string => interpolate(s, tokens);
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
        const t = tok(blockText(content).trim());
        if (!t) break;
        htmlParts.push(
          `<blockquote style="margin:0 0 16px;padding:8px 16px;border-left:3px solid ${accent};color:#555;">${esc(t)}</blockquote>`,
        );
        textParts.push(`"${t}"`);
        break;
      }
      case 'callout': {
        const t = tok(blockText(content).trim());
        if (!t) break;
        htmlParts.push(
          `<div style="margin:0 0 16px;padding:12px 16px;border:1px solid ${accent};background:#f4f8ff;">${esc(t)}</div>`,
        );
        textParts.push(t);
        break;
      }
      case 'image': {
        // The block editor's ImageBlock writes `src`; older/AP content uses `url`.
        const url =
          (typeof content.url === 'string' && content.url) ? content.url
          : typeof content.src === 'string' ? content.src : '';
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
        const href = buildRegistrationHref(content);
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
