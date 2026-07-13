/** Pre-built email templates. Each returns an EmailMessage (with an empty `to`
 *  the caller fills). All HTML goes through the render kernel (escape + branded
 *  shell + themed button), so templates never hand-roll markup or colors. */
import type { EmailMessage, EmailBranding } from './types.js';
import { escapeHtml, wrapTemplate, button, brandAccent } from './render.js';

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
  ): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeUsername = escapeHtml(username);
    const safeTitle = escapeHtml(contest.title);
    const safeUrl = escapeHtml(contest.url);
    const safeUnsub = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : undefined;
    const deadlineLine = contest.deadline
      ? `<p>The submission deadline is <strong>${escapeHtml(contest.deadline)}</strong>. We will send you reminders as it approaches.</p>`
      : '<p>We will send you reminders as the submission deadline approaches.</p>';
    return {
      to: '' as const,
      subject: `You are registered for ${contest.title} -- ${siteName}`,
      html: wrapTemplate(safeName, `
        <h2 style="color:#fff;margin:0 0 16px;">Hi ${safeUsername},</h2>
        <p>You are now registered for <strong>${safeTitle}</strong>.</p>
        ${deadlineLine}
        ${button('View the contest', safeUrl, branding)}
      `, { unsubscribeUrl: safeUnsub, branding }),
      text: `You are registered for ${contest.title}.${contest.deadline ? ` The submission deadline is ${contest.deadline}.` : ''}\n${contest.url}`,
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
  ): EmailMessage & { to: '' } {
    const safeName = escapeHtml(siteName);
    const safeUsername = escapeHtml(username);
    const safeTitle = escapeHtml(contest.title);
    const safeUrl = escapeHtml(contest.url);
    const safeDeadline = escapeHtml(contest.deadline);
    const safeRemaining = escapeHtml(contest.timeRemaining);
    const safeUnsub = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : undefined;
    return {
      to: '' as const,
      subject: `${contest.timeRemaining} left to submit: ${contest.title} -- ${siteName}`,
      html: wrapTemplate(safeName, `
        <h2 style="color:#fff;margin:0 0 16px;">Hi ${safeUsername},</h2>
        <p>The submission deadline for <strong>${safeTitle}</strong> is in about <strong>${safeRemaining}</strong>.</p>
        <p>Submissions close on <strong>${safeDeadline}</strong>. Make sure your entry is in before then.</p>
        ${button('Go to the contest', safeUrl, branding)}
      `, { unsubscribeUrl: safeUnsub, branding }),
      text: `${contest.timeRemaining} left to submit for ${contest.title}. Submissions close on ${contest.deadline}.\n${contest.url}`,
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
