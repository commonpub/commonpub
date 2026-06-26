/** Core email types shared by the adapters, renderer, and templates. */

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
 *
 * Structurally mirrors `emailBrandingSchema` in `@commonpub/schema` (the Zod schema
 * is the write-time validator; this hand-written interface is the render-facing type,
 * kept here so `@commonpub/infra` doesn't depend on `@commonpub/schema`).
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
