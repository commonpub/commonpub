/** Email adapter interface and implementations for CommonPub */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
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
    });
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

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API error (${response.status}): ${body}`);
    }
  }
}

/** Console email adapter — logs emails for development */
export class ConsoleEmailAdapter implements EmailAdapter {
  async send(message: EmailMessage): Promise<void> {
    console.log(`[EMAIL] To: ${message.to}`);
    console.log(`[EMAIL] Subject: ${message.subject}`);
    console.log(`[EMAIL] Body: ${message.text ?? message.html.slice(0, 200)}`);
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
function wrapTemplate(siteName: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="border-bottom:2px solid #5b9cf6;padding-bottom:16px;margin-bottom:24px;">
      <span style="font-family:'JetBrains Mono',monospace;font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#5b9cf6;">${siteName}</span>
    </div>
    <div style="color:#e0e0e0;font-size:16px;line-height:1.7;">
      ${body}
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:32px;padding-top:16px;color:#666;font-size:12px;">
      Sent by ${siteName}. You can manage your notification preferences in your settings.
    </div>
  </div>
</body>
</html>`;
}

/** Pre-built email templates */
export const emailTemplates = {
  verification(siteName: string, verifyUrl: string): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeUrl = escapeHtml(verifyUrl);
    return {
      to: '' as const,
      subject: `Verify your email -- ${siteName}`,
      html: wrapTemplate(safeName, `
        <h2 style="color:#fff;margin:0 0 16px;">Verify your email</h2>
        <p>Click the button below to verify your email address and activate your account.</p>
        <a href="${safeUrl}" style="display:inline-block;background:#5b9cf6;color:#000;padding:12px 24px;text-decoration:none;font-weight:600;margin:16px 0;border:2px solid #5b9cf6;">Verify Email</a>
        <p style="color:#888;font-size:14px;">If you didn't create an account, you can safely ignore this email.</p>
      `),
      text: `Verify your email: ${verifyUrl}`,
    };
  },

  passwordReset(siteName: string, resetUrl: string): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeUrl = escapeHtml(resetUrl);
    return {
      to: '' as const,
      subject: `Reset your password -- ${siteName}`,
      html: wrapTemplate(safeName, `
        <h2 style="color:#fff;margin:0 0 16px;">Reset your password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${safeUrl}" style="display:inline-block;background:#5b9cf6;color:#000;padding:12px 24px;text-decoration:none;font-weight:600;margin:16px 0;border:2px solid #5b9cf6;">Reset Password</a>
        <p style="color:#888;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
      `),
      text: `Reset your password: ${resetUrl}`,
    };
  },

  notificationDigest(
    siteName: string,
    username: string,
    notifications: Array<{ text: string; url: string }>,
  ): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeUsername = escapeHtml(username);
    const items = notifications
      .map((n) => `<li style="margin-bottom:8px;"><a href="${escapeHtml(n.url)}" style="color:#5b9cf6;text-decoration:none;">${escapeHtml(n.text)}</a></li>`)
      .join('');

    return {
      to: '' as const,
      subject: `${notifications.length} new notification${notifications.length === 1 ? '' : 's'} -- ${siteName}`,
      html: wrapTemplate(safeName, `
        <h2 style="color:#fff;margin:0 0 16px;">Hi ${safeUsername},</h2>
        <p>Here's what you missed:</p>
        <ul style="padding-left:20px;">${items}</ul>
      `),
      text: notifications.map((n) => `- ${n.text}: ${n.url}`).join('\n'),
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
