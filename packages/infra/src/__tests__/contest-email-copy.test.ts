import { describe, it, expect } from 'vitest';
import { emailTemplates } from '../email.js';

// Per-contest email copy override (session 232). The two contest participation
// templates accept an optional `copy` (subject + plain-text intro) whose tokens
// are interpolated server-side: HTML-ESCAPED in the HTML body, raw in the subject.
// Everything else (unsubscribe, CTA, deadline line) stays system-owned. When
// `copy` is absent the output is the built-in default, with NO tokenizer applied.

const CONTEST = { title: 'Robot Rumble', url: 'https://x.io/contests/robot', deadline: 'July 19, 2026 at 14:00 UTC' };

describe('contestRegistrationConfirmation — copy override', () => {
  it('uses the default copy (and does NOT tokenize) when copy is absent', () => {
    // A default contest whose title legitimately contains a brace token must NOT
    // be interpolated on the default path.
    const t = emailTemplates.contestRegistrationConfirmation('Site', 'alex', {
      title: 'Cup {username}',
      url: 'https://x.io/contests/cup',
    });
    expect(t.subject).toContain('You are registered for Cup {username}');
    expect(t.html).toContain('You are now registered for <strong>Cup {username}</strong>');
    expect(t.html).toContain('Hi alex,');
    expect(t.html).not.toContain('Cup alex'); // tokenizer not on the default path
  });

  it('interpolates tokens into the subject (raw, plain text)', () => {
    const t = emailTemplates.contestRegistrationConfirmation('Site', 'alex', CONTEST, undefined, undefined, {
      subject: 'Welcome to {contestTitle}, {username}!',
    });
    expect(t.subject).toBe('Welcome to Robot Rumble, alex!');
  });

  it('renders the override intro as escaped paragraphs with escaped token values', () => {
    const t = emailTemplates.contestRegistrationConfirmation(
      'Site',
      'alex',
      { title: '<script>evil</script>', url: 'https://x.io/c', deadline: 'soon' },
      undefined,
      undefined,
      { intro: 'Hi {username}.\n\nYou joined {contestTitle}.' },
    );
    expect(t.html).toContain('<p>Hi alex.</p>');
    expect(t.html).toContain('<p>You joined &lt;script&gt;evil&lt;/script&gt;.</p>');
    expect(t.html).not.toContain('<script>evil</script>'); // value escaped, no injection
    expect(t.html).not.toContain('You are now registered for'); // default lead replaced
  });

  it('leaves unknown tokens literal', () => {
    const t = emailTemplates.contestRegistrationConfirmation('Site', 'alex', CONTEST, undefined, undefined, {
      intro: 'Prize: {mysteryBox}',
    });
    expect(t.html).toContain('Prize: {mysteryBox}');
  });

  it('does not double-interpolate (a token value containing a token is not re-expanded)', () => {
    const t = emailTemplates.contestRegistrationConfirmation(
      'Site',
      'ZZZ',
      { title: 'Team {username}', url: 'https://x.io/c' },
      undefined,
      undefined,
      { intro: 'Join {contestTitle}!' },
    );
    expect(t.html).toContain('Join Team {username}!');
    expect(t.html).not.toContain('Team ZZZ');
  });

  it('keeps system chrome (unsubscribe, CTA, deadline line) with an override', () => {
    const t = emailTemplates.contestRegistrationConfirmation(
      'Site',
      'alex',
      CONTEST,
      'https://x.io/unsub?t=abc',
      undefined,
      { subject: 'Hi', intro: 'Custom {username}.' },
    );
    expect(t.html).toContain('https://x.io/unsub?t=abc'); // unsubscribe link
    expect(t.html).toContain('View the contest'); // CTA button label
    expect(t.html).toContain('July 19, 2026 at 14:00 UTC'); // system deadline line
    expect(t.html).toContain(CONTEST.url); // CTA url
  });
});

describe('contestDeadlineReminder — copy override', () => {
  const RCONTEST = { title: 'Robot Rumble', url: 'https://x.io/contests/robot', deadline: 'July 19, 2026 at 14:00 UTC', timeRemaining: '24 hours' };

  it('defaults unchanged (no tokenizer) when copy absent', () => {
    const t = emailTemplates.contestDeadlineReminder('Site', 'alex', {
      ...RCONTEST,
      title: 'Cup {username}',
    });
    expect(t.subject).toContain('24 hours left to submit: Cup {username}');
    expect(t.html).not.toContain('Cup alex');
  });

  it('supports {timeRemaining} in the override', () => {
    const t = emailTemplates.contestDeadlineReminder('Site', 'alex', RCONTEST, undefined, undefined, {
      subject: '{timeRemaining} left for {contestTitle}',
      intro: 'Only {timeRemaining} remain for {contestTitle}, {username}.',
    });
    expect(t.subject).toBe('24 hours left for Robot Rumble');
    expect(t.html).toContain('Only 24 hours remain for Robot Rumble, alex.');
    expect(t.html).toContain('Submissions close on'); // system deadline line kept
    expect(t.html).toContain('Go to the contest'); // CTA kept
  });
});
