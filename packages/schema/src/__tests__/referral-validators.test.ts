import { describe, it, expect } from 'vitest';
import {
  referralCodeSchema,
  referralRedirectPathSchema,
  referralActionSchema,
  createReferralLinkSchema,
  updateReferralLinkSchema,
  RESERVED_REFERRAL_CODES,
} from '../validators/referral.js';

describe('referralCodeSchema', () => {
  it('accepts a valid custom code and lowercases it', () => {
    const r = referralCodeSchema.safeParse('MyCode-1');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('mycode-1');
  });

  it('rejects too short / too long', () => {
    expect(referralCodeSchema.safeParse('ab').success).toBe(false);
    expect(referralCodeSchema.safeParse('a'.repeat(41)).success).toBe(false);
  });

  it('rejects invalid characters and leading hyphen', () => {
    expect(referralCodeSchema.safeParse('has space').success).toBe(false);
    expect(referralCodeSchema.safeParse('has_underscore').success).toBe(false);
    expect(referralCodeSchema.safeParse('-leading').success).toBe(false);
    expect(referralCodeSchema.safeParse('emoji😀x').success).toBe(false);
  });

  it('rejects reserved route names (case-insensitive)', () => {
    expect(referralCodeSchema.safeParse('admin').success).toBe(false);
    expect(referralCodeSchema.safeParse('Settings').success).toBe(false);
    expect(referralCodeSchema.safeParse('API').success).toBe(false);
    // sanity: the set is non-empty and lowercase
    expect(RESERVED_REFERRAL_CODES.has('admin')).toBe(true);
  });

  it('rejects profanity', () => {
    expect(referralCodeSchema.safeParse('myFUCKlink').success).toBe(false);
  });
});

describe('referralRedirectPathSchema (open-redirect guard)', () => {
  it('accepts same-origin relative paths', () => {
    expect(referralRedirectPathSchema.safeParse('/hubs/makers').success).toBe(true);
    expect(referralRedirectPathSchema.safeParse('/').success).toBe(true);
    expect(referralRedirectPathSchema.safeParse('/a/b-c_d?x=1').success).toBe(true);
  });

  it('rejects protocol-relative, absolute, and scheme URLs', () => {
    expect(referralRedirectPathSchema.safeParse('//evil.com').success).toBe(false);
    expect(referralRedirectPathSchema.safeParse('https://evil.com').success).toBe(false);
    expect(referralRedirectPathSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(referralRedirectPathSchema.safeParse('relative/path').success).toBe(false);
  });

  it('rejects backslashes and control/whitespace characters', () => {
    expect(referralRedirectPathSchema.safeParse('/a\\b').success).toBe(false);
    expect(referralRedirectPathSchema.safeParse('/a b').success).toBe(false);
    expect(referralRedirectPathSchema.safeParse('/a\nb').success).toBe(false);
  });
});

describe('referralActionSchema (bounded vocabulary)', () => {
  it('accepts join_hub with a uuid', () => {
    expect(referralActionSchema.safeParse({ type: 'join_hub', hubId: '6fc2f04e-44ee-4603-9d3c-e1c238dc4e18' }).success).toBe(true);
  });
  it('accepts redirect with a safe path', () => {
    expect(referralActionSchema.safeParse({ type: 'redirect', path: '/hubs/x' }).success).toBe(true);
  });
  it('rejects unknown action types and extra keys', () => {
    expect(referralActionSchema.safeParse({ type: 'grant_admin', userId: 'x' }).success).toBe(false);
    expect(referralActionSchema.safeParse({ type: 'join_hub', hubId: '6fc2f04e-44ee-4603-9d3c-e1c238dc4e18', role: 'admin' }).success).toBe(false);
  });
  it('rejects join_hub with a non-uuid hubId', () => {
    expect(referralActionSchema.safeParse({ type: 'join_hub', hubId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('createReferralLinkSchema', () => {
  it('accepts an empty body (auto-code, no actions)', () => {
    const r = createReferralLinkSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.actions).toEqual([]);
  });
  it('accepts a full body', () => {
    expect(createReferralLinkSchema.safeParse({
      code: 'join-me',
      label: 'My link',
      actions: [{ type: 'join_hub', hubId: '6fc2f04e-44ee-4603-9d3c-e1c238dc4e18' }, { type: 'redirect', path: '/hubs/x' }],
      attributionWindowDays: 30,
    }).success).toBe(true);
  });
  it('rejects unknown keys and too many actions', () => {
    expect(createReferralLinkSchema.safeParse({ evil: 1 }).success).toBe(false);
    const actions = Array.from({ length: 11 }, () => ({ type: 'redirect' as const, path: '/x' }));
    expect(createReferralLinkSchema.safeParse({ actions }).success).toBe(false);
  });
  it('rejects an out-of-range attribution window', () => {
    expect(createReferralLinkSchema.safeParse({ attributionWindowDays: 0 }).success).toBe(false);
    expect(createReferralLinkSchema.safeParse({ attributionWindowDays: 999 }).success).toBe(false);
  });
});

describe('updateReferralLinkSchema', () => {
  it('accepts partial updates incl. status and nullable clears', () => {
    expect(updateReferralLinkSchema.safeParse({ status: 'disabled' }).success).toBe(true);
    expect(updateReferralLinkSchema.safeParse({ label: null, landingPath: null }).success).toBe(true);
  });
  it('rejects an unknown status', () => {
    expect(updateReferralLinkSchema.safeParse({ status: 'paused' }).success).toBe(false);
  });
});
