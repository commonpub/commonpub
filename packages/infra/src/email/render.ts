/**
 * Email render kernel: HTML escaping, the branded shell (`wrapTemplate`), and the
 * themed action button. These are the only places that emit raw HTML, so all
 * injection-safety + branding-application lives here. Module-private to the email
 * dir (not in the package barrel) — only the templates import them.
 */
import type { EmailBranding } from './types.js';

const DEFAULT_ACCENT = '#5b9cf6';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * The email palette.
 *
 * LIGHT on purpose. The shell used to be near-black (`#0a0a0a`) with light grey
 * text, which matched none of the instances actually running: all three render
 * light sites (`color-scheme: light`, near-white `--bg`). It also disagreed with
 * the block renderer, whose callout set a near-white background and inherited
 * the shell's light text -- a measured 1.24:1, effectively invisible.
 *
 * Per-instance colours are a follow-up: `emailBranding` carries an accent, a
 * header, a logo and footer text, and nothing about background or foreground.
 * Until it does, light is the right default rather than a second guess.
 *
 * Every pair below is checked against WCAG AA by `emailContrast.test.ts`.
 */
const PAGE_BG = '#f4f5f7';
const CARD_BG = '#ffffff';
const TEXT = '#1a2230';
const MUTED = '#5a6472';
const RULE = '#dfe3e8';

/** Escape HTML special characters to prevent injection in email templates. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Interpolate a fixed token allow-list into PLAIN text (email subject / text
 * body). Unknown `{tokens}` are left literal. Values are inserted raw — callers
 * use this only where no HTML is emitted. `String.replace(fn)` is single-pass, so
 * a value that itself contains `{token}` is never re-expanded (no double interp).
 */
export function interpolateTokens(input: string, tokens: Record<string, string>): string {
  return input.replace(/\{(\w+)\}/g, (m, k: string) => (Object.prototype.hasOwnProperty.call(tokens, k) ? tokens[k]! : m));
}

/**
 * Render organizer-supplied plain-text intro as escaped `<p>` paragraphs with
 * tokens interpolated as HTML-ESCAPED values. Blank lines split paragraphs (the
 * broadcast pattern). This is the ONLY way organizer copy reaches the HTML body,
 * so there is no injection surface: the paragraph text is escaped first (leaving
 * literal `{token}` intact, since braces aren't escaped), then each token is
 * replaced with an escaped value. Unknown tokens stay literal; no re-expansion.
 */
export function escapedParagraphsWithTokens(input: string, tokens: Record<string, string>): string {
  return input
    .split(/\r?\n\r?\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p>${escapeHtml(p).replace(/\{(\w+)\}/g, (m, k: string) =>
          Object.prototype.hasOwnProperty.call(tokens, k) ? escapeHtml(tokens[k]!) : m,
        )}</p>`,
    )
    .join('');
}

/** Validated accent color (defends the render even if a bad value slipped past write-validation). */
export function brandAccent(branding?: EmailBranding): string {
  const c = branding?.accentColor;
  return typeof c === 'string' && HEX_COLOR.test(c) ? c : DEFAULT_ACCENT;
}

/** The shared email shell with inline styles, header (logo or text), and footer. */
export function wrapTemplate(
  siteName: string,
  body: string,
  opts?: { unsubscribeUrl?: string; branding?: EmailBranding },
): string {
  // A visible one-click unsubscribe link for non-transactional mail (CAN-SPAM /
  // GDPR). Auth mail omits it (no opts.unsubscribeUrl). Pre-escaped by the caller.
  const unsub = opts?.unsubscribeUrl
    ? ` <a href="${opts.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>.`
    : '';
  const b = opts?.branding;
  const accent = brandAccent(b);
  // Header: a custom logo image if set, else the (custom or default) header text.
  const headerLabel = b?.headerText ? escapeHtml(b.headerText) : siteName;
  const header = b?.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" alt="${headerLabel}" style="max-height:40px;max-width:200px;" />`
    : `<span style="font-family:'JetBrains Mono',monospace;font-size:14px;text-transform:uppercase;letter-spacing:2px;color:${accent};">${headerLabel}</span>`;
  const customFooter = b?.footerText ? ` ${escapeHtml(b.footerText)}` : '';
  // `color-scheme: light` tells Gmail/Outlook this mail is already light, so they
  // do not apply their own inversion on top of it.
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:${PAGE_BG};color-scheme:light;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="background:${CARD_BG};border:1px solid ${RULE};padding:28px 24px;">
      <div style="border-bottom:2px solid ${accent};padding-bottom:16px;margin-bottom:24px;">
        ${header}
      </div>
      <div style="color:${TEXT};font-size:16px;line-height:1.7;">
        ${body}
      </div>
      <div style="border-top:1px solid ${RULE};margin-top:32px;padding-top:16px;color:${MUTED};font-size:12px;">
        Sent by ${siteName}. You can manage your notification preferences in your settings.${unsub}${customFooter}
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * A readable label colour for a filled swatch of `hex`.
 *
 * The button used to hardcode black, which passes on the default blue (7.53:1)
 * and fails on a dark brand accent -- deveco's `#aa0000` measured 2.71:1. Derive
 * it from relative luminance instead so every accent gets a readable label.
 */
export function onAccent(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return '#000000';
  const ch = (m[1]!.match(/../g) ?? []).map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  // Contrast against white vs black; pick whichever is higher.
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.05) ? '#ffffff' : '#000000';
}

/** A themed action button using the branding accent. */
export function button(label: string, url: string, branding?: EmailBranding): string {
  const accent = brandAccent(branding);
  return `<a href="${url}" style="display:inline-block;background:${accent};color:${onAccent(accent)};padding:12px 24px;text-decoration:none;font-weight:600;margin:16px 0;border:2px solid ${accent};">${label}</a>`;
}
