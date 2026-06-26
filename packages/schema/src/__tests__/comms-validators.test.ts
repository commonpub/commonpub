import { describe, it, expect } from 'vitest';
import { emailBrandingSchema } from '../validators/comms.js';

// Email Phase 2: branding validated on write so a stored value can't inject
// markup or arbitrary CSS into rendered emails.

describe('emailBrandingSchema', () => {
  it('accepts a valid branding object', () => {
    const r = emailBrandingSchema.safeParse({
      accentColor: '#5b9cf6',
      headerText: 'Acme',
      logoUrl: 'https://cdn.example.com/logo.png',
      footerText: 'Made with care.',
    });
    expect(r.success).toBe(true);
  });

  it('accepts an empty object (all defaults)', () => {
    expect(emailBrandingSchema.safeParse({}).success).toBe(true);
  });

  it('rejects a non-hex accent color (CSS-injection guard)', () => {
    expect(emailBrandingSchema.safeParse({ accentColor: 'red' }).success).toBe(false);
    expect(emailBrandingSchema.safeParse({ accentColor: '#5b9cf6; }body{display:none' }).success).toBe(false);
    expect(emailBrandingSchema.safeParse({ accentColor: '#abc' }).success).toBe(false); // shorthand not allowed
  });

  it('rejects a non-http(s) logo URL (javascript:/data: guard)', () => {
    expect(emailBrandingSchema.safeParse({ logoUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(emailBrandingSchema.safeParse({ logoUrl: 'data:image/png;base64,AAAA' }).success).toBe(false);
    expect(emailBrandingSchema.safeParse({ logoUrl: 'not a url' }).success).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(emailBrandingSchema.safeParse({ evil: '<script>' }).success).toBe(false);
  });

  it('enforces length caps', () => {
    expect(emailBrandingSchema.safeParse({ headerText: 'x'.repeat(81) }).success).toBe(false);
    expect(emailBrandingSchema.safeParse({ footerText: 'x'.repeat(301) }).success).toBe(false);
  });
});
