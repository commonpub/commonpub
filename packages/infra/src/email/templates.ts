/** Pre-built email templates. Each returns an EmailMessage (with an empty `to`
 *  the caller fills). All HTML goes through the render kernel (escape + branded
 *  shell + themed button), so templates never hand-roll markup or colors. */
import type { EmailMessage, EmailBranding } from './types.js';
import { escapeHtml, wrapTemplate, button, brandAccent, interpolateTokens, escapedParagraphsWithTokens } from './render.js';

/** Per-contest email copy override (session 232): organizer-customized subject +
 *  plain-text intro. Absent/empty per field ⇒ the built-in default for that field. */
export interface ContestEmailCopyOverride {
  subject?: string;
  /** Legacy plain-text body (session 232): interpolated + HTML-escaped here. */
  intro?: string;
  /** Pre-rendered, ALREADY-SAFE HTML body from the block editor (rendered by the
   *  server's renderEmailBlocks — email-safe subset, escaped/sanitized upstream).
   *  Superseeds `intro` when present; inserted verbatim, NOT re-escaped. */
  bodyHtml?: string;
  /** Plain-text counterpart to `bodyHtml` for the text/multipart part. */
  bodyText?: string;
}

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

  /**
   * Contest registration confirmation. Sent transactionally when a participant
   * registers for a contest (gated on emailNotifications + a verified address).
   * Confirms the sign-up and surfaces the submission deadline + a link back to
   * the contest page. Carries an unsubscribe link (it is a participation email).
   */
  contestRegistrationConfirmation(
    siteName: string,
    username: string,
    contest: { title: string; url: string; deadline?: string },
    unsubscribeUrl?: string,
    branding?: EmailBranding,
    copy?: ContestEmailCopyOverride,
  ): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeUsername = escapeHtml(username);
    const safeTitle = escapeHtml(contest.title);
    const safeUrl = escapeHtml(contest.url);
    const safeUnsub = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : undefined;
    // Tokens available to a confirmation override (no `{timeRemaining}` here).
    const tokens = { contestTitle: contest.title, deadline: contest.deadline ?? '', username, contestUrl: contest.url };
    // Deadline line + CTA + unsubscribe are system-owned. The deadline line is
    // suppressed when the organizer supplies a block body (copy.bodyHtml): once
    // they author the body they OWN the copy, so we never inject an uneditable
    // paragraph — they can place the (now stage-aware) `{deadline}` token wherever
    // they want. The default (no custom body) still shows it.
    const deadlineLine = copy?.bodyHtml
      ? ''
      : contest.deadline
        ? `<p>The submission deadline is <strong>${escapeHtml(contest.deadline)}</strong>. We will send you reminders as it approaches.</p>`
        : '<p>We will send you reminders as the submission deadline approaches.</p>';
    // Override subject/intro when supplied (tokenized); else the built-in default.
    // The tokenizer runs ONLY on the override branch, so a default title that
    // legitimately contains `{...}` is never interpolated.
    const subject = copy?.subject ? interpolateTokens(copy.subject, tokens) : `You are registered for ${contest.title} -- ${siteName}`;
    // Body precedence: block-editor bodyHtml (already email-safe) > legacy intro
    // (escaped + tokenized) > built-in default.
    const leadHtml = copy?.bodyHtml
      ? copy.bodyHtml
      : copy?.intro
        ? escapedParagraphsWithTokens(copy.intro, tokens)
        : `<h2 style="color:#fff;margin:0 0 16px;">Hi ${safeUsername},</h2>
        <p>You are now registered for <strong>${safeTitle}</strong>.</p>`;
    // Gate BOTH the leadText fallback and the text deadline line on `bodyHtml`
    // (the "organizer authored a block body" signal), matching the HTML gate — a
    // body of only non-text blocks (image w/o alt, divider) yields bodyHtml but no
    // bodyText, and keying the text part off bodyText would make the two MIME parts
    // disagree (text re-adds the deadline + a system-default lead the organizer never wrote).
    const leadText = copy?.bodyHtml
      ? (copy.bodyText ?? '')
      : copy?.intro ? interpolateTokens(copy.intro, tokens) : `You are registered for ${contest.title}.`;
    return {
      to: '' as const,
      subject,
      html: wrapTemplate(safeName, `
        ${leadHtml}
        ${deadlineLine}
        ${button('View the contest', safeUrl, branding)}
      `, { unsubscribeUrl: safeUnsub, branding }),
      text: `${leadText}${!copy?.bodyHtml && contest.deadline ? ` The submission deadline is ${contest.deadline}.` : ''}\n${contest.url}`,
    };
  },

  /**
   * Contest deadline reminder. Sent by the reminder sweep to every registered
   * participant at each milestone (7 days, 48 hours, 24 hours, 1 hour before the
   * deadline), exactly once per participant per milestone. Bulk mail: carries a
   * per-recipient unsubscribe link.
   */
  contestDeadlineReminder(
    siteName: string,
    username: string,
    contest: { title: string; url: string; deadline: string; timeRemaining: string },
    unsubscribeUrl?: string,
    branding?: EmailBranding,
    copy?: ContestEmailCopyOverride,
  ): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeUsername = escapeHtml(username);
    const safeTitle = escapeHtml(contest.title);
    const safeUrl = escapeHtml(contest.url);
    const safeDeadline = escapeHtml(contest.deadline);
    const safeRemaining = escapeHtml(contest.timeRemaining);
    const safeUnsub = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : undefined;
    // The reminder override additionally exposes `{timeRemaining}`.
    const tokens = { contestTitle: contest.title, deadline: contest.deadline, username, timeRemaining: contest.timeRemaining, contestUrl: contest.url };
    // "Submissions close on ..." line + CTA + unsubscribe are system-owned, and
    // the close line is suppressed when the organizer supplies a block body so
    // their copy owns it (the stage-aware `{deadline}`/`{timeRemaining}` tokens
    // are available for them to use). The default still shows it.
    const closeLine = copy?.bodyHtml
      ? ''
      : `<p>Submissions close on <strong>${safeDeadline}</strong>. Make sure your entry is in before then.</p>`;
    const subject = copy?.subject ? interpolateTokens(copy.subject, tokens) : `${contest.timeRemaining} left to submit: ${contest.title} -- ${siteName}`;
    // Body precedence: block-editor bodyHtml (already email-safe) > legacy intro
    // (escaped + tokenized) > built-in default.
    const leadHtml = copy?.bodyHtml
      ? copy.bodyHtml
      : copy?.intro
        ? escapedParagraphsWithTokens(copy.intro, tokens)
        : `<h2 style="color:#fff;margin:0 0 16px;">Hi ${safeUsername},</h2>
        <p>The submission deadline for <strong>${safeTitle}</strong> is in about <strong>${safeRemaining}</strong>.</p>`;
    // Gate leadText on bodyHtml (matching the HTML gate) so a text-less authored
    // body doesn't fall back to the system default lead in the plaintext part.
    const leadText = copy?.bodyHtml
      ? (copy.bodyText ?? '')
      : copy?.intro
        ? interpolateTokens(copy.intro, tokens)
        : `${contest.timeRemaining} left to submit for ${contest.title}.`;
    return {
      to: '' as const,
      subject,
      html: wrapTemplate(safeName, `
        ${leadHtml}
        ${closeLine}
        ${button('Go to the contest', safeUrl, branding)}
      `, { unsubscribeUrl: safeUnsub, branding }),
      text: `${leadText}${copy?.bodyHtml ? '' : ` Submissions close on ${contest.deadline}.`}\n${contest.url}`,
    };
  },

  /**
   * Admin broadcast (email Phase 3). Body is PLAIN TEXT rendered as escaped
   * paragraphs (no operator HTML), plus an optional themed CTA button. Honors
   * branding + an unsubscribe link (it is bulk mail).
   */
  broadcast(
    siteName: string,
    subject: string,
    bodyText: string,
    opts?: { ctaLabel?: string; ctaUrl?: string; unsubscribeUrl?: string; branding?: EmailBranding },
  ): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeSubject = escapeHtml(subject);
    const paragraphs = bodyText
      .split(/\r?\n\r?\n|\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join('');
    const cta = opts?.ctaLabel && opts?.ctaUrl ? button(escapeHtml(opts.ctaLabel), escapeHtml(opts.ctaUrl), opts.branding) : '';
    const safeUnsub = opts?.unsubscribeUrl ? escapeHtml(opts.unsubscribeUrl) : undefined;
    return {
      to: '' as const,
      subject: `${subject} -- ${siteName}`,
      html: wrapTemplate(
        safeName,
        `<h2 style="color:#fff;margin:0 0 16px;">${safeSubject}</h2>${paragraphs}${cta}`,
        { unsubscribeUrl: safeUnsub, branding: opts?.branding },
      ),
      text: `${bodyText}${opts?.ctaUrl ? `\n\n${opts.ctaUrl}` : ''}`,
    };
  },
};
