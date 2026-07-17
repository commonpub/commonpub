/** Email transport adapters: SMTP (nodemailer), Resend (HTTP API), Console (dev). */
import { EMAIL_HTTP_TIMEOUT_MS } from './types.js';
import type { EmailAdapter, EmailMessage, EmailSendResult } from './types.js';

/** SMTP email adapter — uses nodemailer-compatible transports. */
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

/** Resend email adapter — uses the Resend HTTP API. */
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

/** Console email adapter — logs emails for development. */
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
