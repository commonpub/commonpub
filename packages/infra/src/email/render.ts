/**
 * Email render kernel: HTML escaping, the branded shell (`wrapTemplate`), and the
 * themed action button. These are the only places that emit raw HTML, so all
 * injection-safety + branding-application lives here. Module-private to the email
 * dir (not in the package barrel) — only the templates import them.
 */
import type { EmailBranding } from './types.js';

const DEFAULT_ACCENT = '#5b9cf6';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Escape HTML special characters to prevent injection in email templates. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
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
    ? ` <a href="${opts.unsubscribeUrl}" style="color:#888;text-decoration:underline;">Unsubscribe</a>.`
    : '';
  const b = opts?.branding;
  const accent = brandAccent(b);
  // Header: a custom logo image if set, else the (custom or default) header text.
  const headerLabel = b?.headerText ? escapeHtml(b.headerText) : siteName;
  const header = b?.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" alt="${headerLabel}" style="max-height:40px;max-width:200px;" />`
    : `<span style="font-family:'JetBrains Mono',monospace;font-size:14px;text-transform:uppercase;letter-spacing:2px;color:${accent};">${headerLabel}</span>`;
  const customFooter = b?.footerText ? ` ${escapeHtml(b.footerText)}` : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="border-bottom:2px solid ${accent};padding-bottom:16px;margin-bottom:24px;">
      ${header}
    </div>
    <div style="color:#e0e0e0;font-size:16px;line-height:1.7;">
      ${body}
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:32px;padding-top:16px;color:#666;font-size:12px;">
      Sent by ${siteName}. You can manage your notification preferences in your settings.${unsub}${customFooter}
    </div>
  </div>
</body>
</html>`;
}

/** A themed action button using the branding accent. */
export function button(label: string, url: string, branding?: EmailBranding): string {
  const accent = brandAccent(branding);
  return `<a href="${url}" style="display:inline-block;background:${accent};color:#000;padding:12px 24px;text-decoration:none;font-weight:600;margin:16px 0;border:2px solid ${accent};">${label}</a>`;
}
