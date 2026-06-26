import { describe, it, expect } from 'vitest';
import { emailBrandingSchema, broadcastInputSchema, broadcastAudienceSchema } from '../validators/comms.js';

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

describe('broadcastAudienceSchema', () => {
  it('accepts all / role / userIds', () => {
    expect(broadcastAudienceSchema.safeParse('all').success).toBe(true);
    expect(broadcastAudienceSchema.safeParse({ role: 'staff' }).success).toBe(true);
    expect(broadcastAudienceSchema.safeParse({ userIds: ['6fc2f04e-44ee-4603-9d3c-e1c238dc4e18'] }).success).toBe(true);
  });
  it('rejects bad role / empty userIds / unknown shape', () => {
    expect(broadcastAudienceSchema.safeParse({ role: 'wizard' }).success).toBe(false);
    expect(broadcastAudienceSchema.safeParse({ userIds: [] }).success).toBe(false);
    expect(broadcastAudienceSchema.safeParse({ userIds: ['not-a-uuid'] }).success).toBe(false);
    expect(broadcastAudienceSchema.safeParse('everyone').success).toBe(false);
  });
});

describe('broadcastInputSchema', () => {
  const base = { subject: 'Hello', bodyText: 'Body', audience: 'all' as const };
  it('accepts a minimal valid broadcast', () => {
    expect(broadcastInputSchema.safeParse(base).success).toBe(true);
  });
  it('accepts a CTA with both label and http(s) url', () => {
    expect(broadcastInputSchema.safeParse({ ...base, ctaLabel: 'Go', ctaUrl: 'https://x.com' }).success).toBe(true);
  });
  it('rejects a half CTA (label without url, or vice versa)', () => {
    expect(broadcastInputSchema.safeParse({ ...base, ctaLabel: 'Go' }).success).toBe(false);
    expect(broadcastInputSchema.safeParse({ ...base, ctaUrl: 'https://x.com' }).success).toBe(false);
  });
  it('rejects a non-http(s) CTA url', () => {
    expect(broadcastInputSchema.safeParse({ ...base, ctaLabel: 'Go', ctaUrl: 'javascript:alert(1)' }).success).toBe(false);
  });
  it('requires non-empty subject + body and rejects unknown keys', () => {
    expect(broadcastInputSchema.safeParse({ ...base, subject: '' }).success).toBe(false);
    expect(broadcastInputSchema.safeParse({ ...base, bodyText: '' }).success).toBe(false);
    expect(broadcastInputSchema.safeParse({ ...base, evil: 1 }).success).toBe(false);
  });
});
