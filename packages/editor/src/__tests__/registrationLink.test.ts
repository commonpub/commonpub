import { describe, it, expect } from 'vitest';
import {
  buildRegistrationHref,
  absolutizeHref,
  registrationLabel,
  registrationVariant,
  REGISTRATION_DEFAULT_URL,
} from '../blocks/registrationLink';

describe('buildRegistrationHref', () => {
  it('defaults to the register page when url is blank/missing', () => {
    expect(buildRegistrationHref({})).toBe(REGISTRATION_DEFAULT_URL);
    expect(buildRegistrationHref({ url: '' })).toBe(REGISTRATION_DEFAULT_URL);
    expect(buildRegistrationHref({ url: '   ' })).toBe(REGISTRATION_DEFAULT_URL);
  });

  it('keeps a safe http(s) / root / mailto / tel / fragment url', () => {
    expect(buildRegistrationHref({ url: 'https://example.com/join' })).toBe('https://example.com/join');
    expect(buildRegistrationHref({ url: '/r/abc123' })).toBe('/r/abc123');
    expect(buildRegistrationHref({ url: 'mailto:join@example.com' })).toBe('mailto:join@example.com');
    expect(buildRegistrationHref({ url: '#signup' })).toBe('#signup');
  });

  it('falls back to the register page for an unsafe url (javascript:, data:, protocol-relative, backslash)', () => {
    expect(buildRegistrationHref({ url: 'javascript:alert(1)' })).toBe(REGISTRATION_DEFAULT_URL);
    expect(buildRegistrationHref({ url: 'data:text/html,<script>1</script>' })).toBe(REGISTRATION_DEFAULT_URL);
    expect(buildRegistrationHref({ url: '//evil.com' })).toBe(REGISTRATION_DEFAULT_URL);
    // Backslash variants a browser normalizes `\`→`/` into an off-site //host.
    expect(buildRegistrationHref({ url: '/\\evil.com' })).toBe(REGISTRATION_DEFAULT_URL);
    expect(buildRegistrationHref({ url: '/\\/evil.com' })).toBe(REGISTRATION_DEFAULT_URL);
    expect(buildRegistrationHref({ url: '\\\\evil.com' })).toBe(REGISTRATION_DEFAULT_URL);
  });

  it('appends a referral code to http(s)/root targets, respecting existing query', () => {
    expect(buildRegistrationHref({ ref: 'abc' })).toBe(`${REGISTRATION_DEFAULT_URL}?ref=abc`);
    expect(buildRegistrationHref({ url: '/auth/register', ref: 'x y' })).toBe('/auth/register?ref=x%20y');
    expect(buildRegistrationHref({ url: 'https://x.com/j?a=1', ref: 'abc' })).toBe('https://x.com/j?a=1&ref=abc');
  });

  it('does NOT append a referral to fragment/mailto/tel targets', () => {
    expect(buildRegistrationHref({ url: '#signup', ref: 'abc' })).toBe('#signup');
    expect(buildRegistrationHref({ url: 'mailto:a@b.com', ref: 'abc' })).toBe('mailto:a@b.com');
  });

  it('ignores an unsafe url even when a ref is present (no smuggling)', () => {
    expect(buildRegistrationHref({ url: 'javascript:alert(1)', ref: 'abc' })).toBe(`${REGISTRATION_DEFAULT_URL}?ref=abc`);
  });
});

describe('buildRegistrationHref — injected fallback (contest emails)', () => {
  const CONTEST = 'https://deveco.io/contests/resilient/register';

  it('uses the injected fallback instead of the account-signup page when url is blank', () => {
    // The recipient of a contest email already HAS an account, so /auth/register is
    // a dead end — the send path retargets the blank block at the contest.
    expect(buildRegistrationHref({}, { fallbackUrl: CONTEST })).toBe(CONTEST);
    expect(buildRegistrationHref({ url: '   ' }, { fallbackUrl: CONTEST })).toBe(CONTEST);
  });

  it('still lets an explicitly authored safe url win', () => {
    expect(buildRegistrationHref({ url: 'https://partner.example/join' }, { fallbackUrl: CONTEST }))
      .toBe('https://partner.example/join');
    expect(buildRegistrationHref({ url: '/auth/register' }, { fallbackUrl: CONTEST })).toBe('/auth/register');
  });

  it('falls back for an UNSAFE authored url (no javascript: smuggling past the fallback)', () => {
    expect(buildRegistrationHref({ url: 'javascript:alert(1)' }, { fallbackUrl: CONTEST })).toBe(CONTEST);
    expect(buildRegistrationHref({ url: '//evil.com' }, { fallbackUrl: CONTEST })).toBe(CONTEST);
  });

  it('appends a referral code to the fallback target', () => {
    expect(buildRegistrationHref({ ref: 'abc' }, { fallbackUrl: CONTEST })).toBe(`${CONTEST}?ref=abc`);
  });

  it('degrades to the register page when the injected fallback is itself unusable', () => {
    for (const bad of ['javascript:alert(1)', '//evil.com', '', '   ']) {
      expect(buildRegistrationHref({}, { fallbackUrl: bad })).toBe(REGISTRATION_DEFAULT_URL);
    }
  });

  it('is unchanged without opts (public content keeps the account-signup default)', () => {
    expect(buildRegistrationHref({})).toBe(REGISTRATION_DEFAULT_URL);
  });
});

describe('absolutizeHref', () => {
  const ORIGIN = 'https://deveco.io';

  it('resolves a root-relative href against the origin (the https://auth/register bug)', () => {
    // Left relative, a mail client prepends the scheme -> https:///auth/register,
    // which URL-normalizes to the host `auth`. This is the guard against that.
    expect(absolutizeHref('/auth/register', ORIGIN)).toBe('https://deveco.io/auth/register');
    expect(absolutizeHref(buildRegistrationHref({}), ORIGIN)).toBe('https://deveco.io/auth/register');
    expect(absolutizeHref(buildRegistrationHref({ ref: 'abc' }), ORIGIN)).toBe('https://deveco.io/auth/register?ref=abc');
  });

  it('leaves absolute and non-navigational targets untouched', () => {
    expect(absolutizeHref('https://example.com/join', ORIGIN)).toBe('https://example.com/join');
    expect(absolutizeHref('http://example.com/join', ORIGIN)).toBe('http://example.com/join');
    expect(absolutizeHref('mailto:a@b.com', ORIGIN)).toBe('mailto:a@b.com');
    expect(absolutizeHref('tel:+15551234', ORIGIN)).toBe('tel:+15551234');
  });

  it('anchors a bare fragment at the site root (no page base in an email)', () => {
    expect(absolutizeHref('#signup', ORIGIN)).toBe('https://deveco.io/#signup');
  });

  it('tolerates a trailing slash / missing origin without producing a double slash', () => {
    expect(absolutizeHref('/auth/register', 'https://deveco.io/')).toBe('https://deveco.io/auth/register');
    expect(absolutizeHref('/auth/register', 'https://deveco.io///')).toBe('https://deveco.io/auth/register');
    expect(absolutizeHref('/auth/register', undefined)).toBe('/auth/register');
    expect(absolutizeHref('/auth/register', '')).toBe('/auth/register');
    expect(absolutizeHref('/auth/register', '   ')).toBe('/auth/register');
  });

  it('ignores a hostless origin rather than corrupting the href', () => {
    // A misconfigured instance can produce `https://` (siteUrl unset + blank domain).
    expect(absolutizeHref('/auth/register', 'https://')).toBe('/auth/register');
    expect(absolutizeHref('/auth/register', 'deveco.io')).toBe('/auth/register');
    // A site served under a sub-path is a legitimate base.
    expect(absolutizeHref('/auth/register', 'https://x.example/app')).toBe('https://x.example/app/auth/register');
  });
});

describe('registrationLabel / registrationVariant', () => {
  it('defaults the label to "Register" and trims', () => {
    expect(registrationLabel({})).toBe('Register');
    expect(registrationLabel({ label: '  Enter now  ' })).toBe('Enter now');
    expect(registrationLabel({ label: '   ' })).toBe('Register');
  });

  it('defaults the variant to primary and accepts secondary', () => {
    expect(registrationVariant({})).toBe('primary');
    expect(registrationVariant({ variant: 'secondary' })).toBe('secondary');
    expect(registrationVariant({ variant: 'bogus' })).toBe('primary');
  });
});
