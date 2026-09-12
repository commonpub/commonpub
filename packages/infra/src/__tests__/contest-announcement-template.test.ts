import { describe, it, expect } from 'vitest';
import { emailTemplates } from '../email/templates.js';

// The contest announcement template (session 259). Unlike the two participation
// emails, the organizer owns the ENTIRE body: there is no built-in default copy
// to fall back to, and no system-injected deadline line. What stays system-owned
// is the shell, the "View the contest" CTA, and the unsubscribe link.

const CONTEST = { title: 'Summer Build-Off', url: 'https://test.example/contests/summer' };
const BODY = { html: '<p>Kickoff is Monday.</p>', text: 'Kickoff is Monday.' };
const TOKENS = { username: 'ada', displayName: 'Ada L', contestTitle: CONTEST.title, contestUrl: CONTEST.url, deadline: '', timeRemaining: '', siteName: 'Test', siteUrl: 'https://test.example' };

function render(over: Partial<Parameters<typeof emailTemplates.contestAnnouncement>[0]> = {}) {
  return emailTemplates.contestAnnouncement({
    siteName: 'Test',
    subject: 'An update',
    contest: CONTEST,
    bodyHtml: BODY.html,
    bodyText: BODY.text,
    tokens: TOKENS,
    unsubscribeUrl: 'https://test.example/unsubscribe?t=abc',
    ...over,
  });
}

describe('emailTemplates.contestAnnouncement', () => {
  it('uses the organizer subject verbatim, with tokens resolved', () => {
    expect(render({ subject: 'News about {contestTitle}' }).subject).toBe('News about Summer Build-Off');
  });

  it('leaves an unknown token literal rather than blanking it', () => {
    expect(render({ subject: 'Hi {nope}' }).subject).toBe('Hi {nope}');
  });

  it('does not append the site name to the subject (the organizer owns it)', () => {
    expect(render({ subject: 'An update' }).subject).toBe('An update');
  });

  it('inserts the pre-rendered body verbatim, without re-escaping it', () => {
    const out = render({ bodyHtml: '<p>Already <strong>safe</strong>.</p>' });
    expect(out.html).toContain('<p>Already <strong>safe</strong>.</p>');
    expect(out.html).not.toContain('&lt;strong&gt;');
  });

  it('carries the system CTA back to the contest', () => {
    const out = render();
    expect(out.html).toContain('View the contest');
    expect(out.html).toContain('https://test.example/contests/summer');
  });

  it('carries the unsubscribe link (an announcement is never transactional)', () => {
    expect(render().html).toContain('https://test.example/unsubscribe?t=abc');
    expect(render().html).toContain('Unsubscribe');
  });

  it('puts the plain-text body and the contest URL in the text part', () => {
    const out = render();
    expect(out.text).toContain('Kickoff is Monday.');
    expect(out.text).toContain(CONTEST.url);
  });

  // A subject reaches the wire as a header. The validator rejects CR/LF on write,
  // but the template is the last line of defence for anything already stored.
  it('strips CR and LF from the subject even if one slipped past validation', () => {
    expect(render({ subject: 'Hi\r\nBcc: evil@example.com' }).subject).not.toMatch(/[\r\n]/);
  });

  // A subject is a plain-text header, not HTML. HTML-escaping token values there
  // is not safety, it is corruption: it is what turned `Q&A Jam` into
  // `Q&amp;A Jam` in a delivered email. The two existing contest templates pass
  // raw values for exactly this reason, and this pins the parity.
  it('puts token values in the subject RAW, so an ampersand is not double-encoded', () => {
    const out = render({ subject: 'News about {contestTitle}', tokens: { ...TOKENS, contestTitle: 'Q&A Jam' } });
    expect(out.subject).toBe('News about Q&A Jam');
    expect(out.subject).not.toContain('&amp;');
  });

  it('matches contestRegistrationConfirmation for the same subject and token', () => {
    const mine = render({ subject: 'News about {contestTitle}', tokens: { ...TOKENS, contestTitle: 'Q&A Jam' } }).subject;
    const theirs = emailTemplates.contestRegistrationConfirmation(
      'Test', 'ada', { title: 'Q&A Jam', url: CONTEST.url }, undefined, undefined,
      { subject: 'News about {contestTitle}' },
    ).subject;
    expect(mine).toBe(theirs);
  });

  // Markup in a token reaches the subject literally, which is correct for a
  // plain-text header: every mail client renders a subject as text. What must
  // NEVER get through is a line break, which can split headers.
  it('carries markup in a token through as literal text without executing anything', () => {
    const out = render({ subject: 'Hello {displayName}', tokens: { ...TOKENS, displayName: '<b>Ada</b>' } });
    expect(out.subject).toBe('Hello <b>Ada</b>');
  });

  it('collapses a line break smuggled in through a TOKEN value, not just the subject', () => {
    const out = render({ subject: 'Hello {displayName}', tokens: { ...TOKENS, displayName: 'Ada\r\nBcc: evil@example.com' } });
    expect(out.subject).not.toMatch(/[\r\n]/);
  });

  it('escapes the contest title and the site name in the shell', () => {
    const out = render({
      siteName: '<img src=x>',
      contest: { title: '<script>bad()</script>', url: CONTEST.url },
    });
    expect(out.html).not.toContain('<script>bad()</script>');
    expect(out.html).not.toContain('<img src=x>');
  });

  it('renders an empty body without crashing, so a chrome-only send is still valid HTML', () => {
    const out = render({ bodyHtml: '', bodyText: '' });
    expect(out.html).toContain('View the contest');
    expect(out.text).toContain(CONTEST.url);
  });
});
