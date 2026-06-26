/** Email adapter interface and implementations for CommonPub */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Extra headers (e.g. List-Unsubscribe / List-Unsubscribe-Post, RFC 8058). */
  headers?: Record<string, string>;
}

/** Per-message outcome from a batch send, in the SAME order as the input. */
export interface EmailSendResult {
  ok: boolean;
  error?: string;
}

/**
 * Operator-customizable email branding (email Phase 2), persisted per instance in
 * `instance_settings['email.branding']` and validated on write. All fields optional;
 * each falls back to the built-in default. Values are escaped/validated at render so
 * a stored value can't inject markup or arbitrary CSS.
 */
export interface EmailBranding {
  /** Header band accent + action-button color. Must be #rrggbb. */
  accentColor?: string;
  /** Header label (defaults to the instance name). */
  headerText?: string;
  /** Optional logo image shown in the header (http/https only). */
  logoUrl?: string;
  /** Extra line appended to the footer. */
  footerText?: string;
}

const DEFAULT_ACCENT = '#5b9cf6';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Validated accent color (defends the render even if a bad value slipped past write-validation). */
function brandAccent(branding?: EmailBranding): string {
  const c = branding?.accentColor;
  return typeof c === 'string' && HEX_COLOR.test(c) ? c : DEFAULT_ACCENT;
}

/** Network timeout for a single provider HTTP call. Must stay well under the
 *  outbox worker's row lock TTL so a hung call can't outlive its claim. */
export const EMAIL_HTTP_TIMEOUT_MS = 30_000;

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
  /**
   * Send many messages and report each one's outcome (same order, one result per
   * input). The worker marks ONLY the `ok` rows as sent and reschedules the rest,
   * so a partial provider failure can neither silently drop nor blindly resend the
   * whole chunk. A thrown error means a transport-level failure where NOTHING was
   * accepted — the caller treats every message in the chunk as failed. Keep chunks
   * <= 100 (Resend's batch limit).
   */
  sendBatch(messages: EmailMessage[]): Promise<EmailSendResult[]>;
}

/** SMTP email adapter — uses nodemailer-compatible transports */
export class SmtpEmailAdapter implements EmailAdapter {
  private host: string;
  private port: number;
  private secure: boolean;
  private user: string;
  private pass: string;
  private from: string;

  constructor(config: {
    host: string;
    port: number;
    secure?: boolean;
    user: string;
    pass: string;
    from: string;
  }) {
    this.host = config.host;
    this.port = config.port;
    this.secure = config.secure ?? config.port === 465;
    this.user = config.user;
    this.pass = config.pass;
    this.from = config.from;
  }

  async send(message: EmailMessage): Promise<void> {
    // Dynamic import to keep nodemailer optional
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let nodemailer: Record<string, unknown>;
    try {
      nodemailer = await (Function('return import("nodemailer")')() as Promise<Record<string, unknown>>);
    } catch {
      throw new Error('nodemailer is required for SMTP email. Install with: pnpm add nodemailer');
    }
    const createTransport = nodemailer['createTransport'] as (opts: Record<string, unknown>) => { sendMail: (msg: Record<string, unknown>) => Promise<void> };
    const transport = createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: { user: this.user, pass: this.pass },
    });

    await transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
    });
  }

  // SMTP has no batch primitive — send sequentially, attributing each result so a
  // mid-loop failure neither loses the rest nor resends the ones already sent.
  async sendBatch(messages: EmailMessage[]): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];
    for (const m of messages) {
      try {
        await this.send(m);
        results.push({ ok: true });
      } catch (err) {
        results.push({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return results;
  }
}

/** Resend email adapter — uses the Resend HTTP API */
export class ResendEmailAdapter implements EmailAdapter {
  private apiKey: string;
  private from: string;

  constructor(config: { apiKey: string; from: string }) {
    this.apiKey = config.apiKey;
    this.from = config.from;
  }

  private toPayload(message: EmailMessage): Record<string, unknown> {
    return {
      from: this.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
    };
  }

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.toPayload(message)),
      signal: AbortSignal.timeout(EMAIL_HTTP_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API error (${response.status}): ${body}`);
    }
  }

  // Resend's batch endpoint accepts up to 100 messages per call and responds
  // `200 { data: [{ id }, ...] }` with one entry per ACCEPTED message, in order.
  // We attribute per-message: an aligned `data[i].id` => that message was accepted;
  // anything else (missing entry, no id, length mismatch) => that message failed
  // and must be retried, so a partial acceptance never silently drops mail. A
  // transport-level failure throws (caller fails the whole chunk).
  async sendBatch(messages: EmailMessage[]): Promise<EmailSendResult[]> {
    if (messages.length === 0) return [];
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages.map((m) => this.toPayload(m))),
      signal: AbortSignal.timeout(EMAIL_HTTP_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend batch API error (${response.status}): ${body}`);
    }

    const parsed = (await response.json().catch(() => null)) as { data?: Array<{ id?: string }> } | null;
    const data = Array.isArray(parsed?.data) ? parsed!.data : [];
    return messages.map((_, i) =>
      typeof data[i]?.id === 'string'
        ? { ok: true }
        : { ok: false, error: 'Resend batch: message not acknowledged' },
    );
  }
}

/** Console email adapter — logs emails for development */
export class ConsoleEmailAdapter implements EmailAdapter {
  async send(message: EmailMessage): Promise<void> {
    console.log(`[EMAIL] To: ${message.to}`);
    console.log(`[EMAIL] Subject: ${message.subject}`);
    console.log(`[EMAIL] Body: ${message.text ?? message.html.slice(0, 200)}`);
  }

  async sendBatch(messages: EmailMessage[]): Promise<EmailSendResult[]> {
    for (const m of messages) await this.send(m);
    return messages.map(() => ({ ok: true }));
  }
}

/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Email template builder with inline styles */
function wrapTemplate(
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
function button(label: string, url: string, branding?: EmailBranding): string {
  const accent = brandAccent(branding);
  return `<a href="${url}" style="display:inline-block;background:${accent};color:#000;padding:12px 24px;text-decoration:none;font-weight:600;margin:16px 0;border:2px solid ${accent};">${label}</a>`;
}

/** Pre-built email templates */
export const emailTemplates = {
  verification(siteName: string, verifyUrl: string, branding?: EmailBranding): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeUrl = escapeHtml(verifyUrl);
    return {
      to: '' as const,
      subject: `Verify your email -- ${siteName}`,
      html: wrapTemplate(safeName, `
        <h2 style="color:#fff;margin:0 0 16px;">Verify your email</h2>
        <p>Click the button below to verify your email address and activate your account.</p>
        ${button('Verify Email', safeUrl, branding)}
        <p style="color:#888;font-size:14px;">If you didn't create an account, you can safely ignore this email.</p>
      `, { branding }),
      text: `Verify your email: ${verifyUrl}`,
    };
  },

  passwordReset(siteName: string, resetUrl: string, branding?: EmailBranding): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeUrl = escapeHtml(resetUrl);
    return {
      to: '' as const,
      subject: `Reset your password -- ${siteName}`,
      html: wrapTemplate(safeName, `
        <h2 style="color:#fff;margin:0 0 16px;">Reset your password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        ${button('Reset Password', safeUrl, branding)}
        <p style="color:#888;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
      `, { branding }),
      text: `Reset your password: ${resetUrl}`,
    };
  },

  notificationDigest(
    siteName: string,
    username: string,
    notifications: Array<{ text: string; url: string }>,
    unsubscribeUrl?: string,
    branding?: EmailBranding,
  ): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeUsername = escapeHtml(username);
    const safeUnsub = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : undefined;
    const linkColor = brandAccent(branding);
    const items = notifications
      .map((n) => `<li style="margin-bottom:8px;"><a href="${escapeHtml(n.url)}" style="color:${linkColor};text-decoration:none;">${escapeHtml(n.text)}</a></li>`)
      .join('');

    return {
      to: '' as const,
      subject: `${notifications.length} new notification${notifications.length === 1 ? '' : 's'} -- ${siteName}`,
      html: wrapTemplate(safeName, `
        <h2 style="color:#fff;margin:0 0 16px;">Hi ${safeUsername},</h2>
        <p>Here's what you missed:</p>
        <ul style="padding-left:20px;">${items}</ul>
      `, { unsubscribeUrl: safeUnsub, branding }),
      text: notifications.map((n) => `- ${n.text}: ${n.url}`).join('\n'),
    };
  },

  notificationInstant(
    siteName: string,
    username: string,
    notification: { title: string; message: string; url: string },
    unsubscribeUrl?: string,
    branding?: EmailBranding,
  ): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeUsername = escapeHtml(username);
    const safeTitle = escapeHtml(notification.title);
    const safeMessage = escapeHtml(notification.message);
    const safeUrl = escapeHtml(notification.url);
    const safeUnsub = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : undefined;
    return {
      to: '' as const,
      subject: `${notification.title} -- ${siteName}`,
      html: wrapTemplate(safeName, `
        <h2 style="color:#fff;margin:0 0 16px;">Hi ${safeUsername},</h2>
        <p><strong>${safeTitle}</strong></p>
        <p>${safeMessage}</p>
        ${button('View', safeUrl, branding)}
      `, { unsubscribeUrl: safeUnsub, branding }),
      text: `${notification.title}: ${notification.message}\n${notification.url}`,
    };
  },

  contestAnnouncement(
    siteName: string,
    contestTitle: string,
    contestUrl: string,
    message: string,
  ): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeTitle = escapeHtml(contestTitle);
    const safeUrl = escapeHtml(contestUrl);
    const safeMessage = escapeHtml(message);
    return {
      to: '' as const,
      subject: `${contestTitle} -- ${siteName}`,
      html: wrapTemplate(safeName, `
        <h2 style="color:#fff;margin:0 0 16px;">${safeTitle}</h2>
        <p>${safeMessage}</p>
        <a href="${safeUrl}" style="display:inline-block;background:#5b9cf6;color:#000;padding:12px 24px;text-decoration:none;font-weight:600;margin:16px 0;border:2px solid #5b9cf6;">View Contest</a>
      `),
      text: `${contestTitle}: ${message}\n${contestUrl}`,
    };
  },

  certificateIssued(
    siteName: string,
    pathTitle: string,
    verificationCode: string,
    certificateUrl: string,
  ): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeTitle = escapeHtml(pathTitle);
    const safeCode = escapeHtml(verificationCode);
    const safeUrl = escapeHtml(certificateUrl);
    return {
      to: '' as const,
      subject: `Certificate earned: ${pathTitle} -- ${siteName}`,
      html: wrapTemplate(safeName, `
        <h2 style="color:#fff;margin:0 0 16px;">Congratulations!</h2>
        <p>You've earned a certificate for completing <strong>${safeTitle}</strong>.</p>
        <p>Verification code: <code style="background:#1a1a1a;padding:4px 8px;border:1px solid #333;color:#5b9cf6;">${safeCode}</code></p>
        <a href="${safeUrl}" style="display:inline-block;background:#5b9cf6;color:#000;padding:12px 24px;text-decoration:none;font-weight:600;margin:16px 0;border:2px solid #5b9cf6;">View Certificate</a>
      `),
      text: `Certificate earned for ${pathTitle}. Code: ${verificationCode}\n${certificateUrl}`,
    };
  },
};
