import { describe, it, expect } from 'vitest';
import {
  buildRegistrationHref,
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

  it('falls back to the register page for an unsafe url (javascript:, data:, protocol-relative)', () => {
    expect(buildRegistrationHref({ url: 'javascript:alert(1)' })).toBe(REGISTRATION_DEFAULT_URL);
    expect(buildRegistrationHref({ url: 'data:text/html,<script>1</script>' })).toBe(REGISTRATION_DEFAULT_URL);
    expect(buildRegistrationHref({ url: '//evil.com' })).toBe(REGISTRATION_DEFAULT_URL);
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
