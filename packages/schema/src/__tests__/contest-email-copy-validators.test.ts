import { describe, it, expect } from 'vitest';
import { contestEmailCopySchema } from '../validators/contest.js';

// Per-contest email copy override (session 232). Organizers customize the subject
// + plain-text intro of the two contest participation emails; everything else is
// system-owned. Validated on write, re-validated on read (mirrors emailBranding).
describe('contestEmailCopySchema', () => {
  it('accepts an empty object (no override)', () => {
    expect(contestEmailCopySchema.safeParse({}).success).toBe(true);
  });

  it('accepts subject + intro for either template', () => {
    const ok = contestEmailCopySchema.safeParse({
      confirmation: { subject: 'Welcome to {contestTitle}', intro: 'Hi {username}, you are in.' },
      reminder: { subject: '{timeRemaining} left', intro: 'Only {timeRemaining} to go for {contestTitle}.' },
    });
    expect(ok.success).toBe(true);
  });

  it('accepts a partial override (subject only, one template)', () => {
    expect(contestEmailCopySchema.safeParse({ confirmation: { subject: 'Hi' } }).success).toBe(true);
    expect(contestEmailCopySchema.safeParse({ reminder: {} }).success).toBe(true);
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(contestEmailCopySchema.safeParse({ evil: 1 }).success).toBe(false);
    expect(contestEmailCopySchema.safeParse({ confirmation: { subject: 'x', evil: 1 } }).success).toBe(false);
  });

  it('rejects a non-string subject/intro', () => {
    expect(contestEmailCopySchema.safeParse({ confirmation: { subject: 5 } }).success).toBe(false);
  });

  it('enforces length caps (subject 200, intro 2000)', () => {
    expect(contestEmailCopySchema.safeParse({ confirmation: { subject: 'a'.repeat(201) } }).success).toBe(false);
    expect(contestEmailCopySchema.safeParse({ confirmation: { subject: 'a'.repeat(200) } }).success).toBe(true);
    expect(contestEmailCopySchema.safeParse({ reminder: { intro: 'a'.repeat(2001) } }).success).toBe(false);
    expect(contestEmailCopySchema.safeParse({ reminder: { intro: 'a'.repeat(2000) } }).success).toBe(true);
  });

  it('trims whitespace', () => {
    const parsed = contestEmailCopySchema.safeParse({ confirmation: { subject: '  hi  ' } });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.confirmation?.subject).toBe('hi');
  });
});
