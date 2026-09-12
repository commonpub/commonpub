import { describe, it, expect } from 'vitest';
import {
  contestAnnouncementAudienceSchema,
  contestAnnouncementInputSchema,
  contestAnnouncementPreviewSchema,
  contestAnnouncementTestSchema,
} from '../validators/contest.js';

const BLOCKS = [['heading', { text: 'Hi {username}', level: 2 }], ['paragraph', { text: 'Body' }]];

describe('contestAnnouncementAudienceSchema', () => {
  it('defaults the tier to `all` so an omitted tier means every registrant', () => {
    const r = contestAnnouncementAudienceSchema.safeParse({ kind: 'registrants' });
    expect(r.success).toBe(true);
    expect(r.success && r.data.tier).toBe('all');
  });

  it('accepts each explicit tier', () => {
    for (const tier of ['full', 'reminders', 'all'] as const) {
      expect(contestAnnouncementAudienceSchema.safeParse({ kind: 'registrants', tier }).success).toBe(true);
    }
  });

  it('rejects an unknown tier, an unknown kind, and unknown keys', () => {
    expect(contestAnnouncementAudienceSchema.safeParse({ kind: 'registrants', tier: 'everyone' }).success).toBe(false);
    expect(contestAnnouncementAudienceSchema.safeParse({ kind: 'judges' }).success).toBe(false);
    expect(contestAnnouncementAudienceSchema.safeParse({ kind: 'registrants', evil: 1 }).success).toBe(false);
  });
});

describe('contestAnnouncementInputSchema', () => {
  const base = { subject: 'An update on {contestTitle}', bodyBlocks: BLOCKS, audience: { kind: 'registrants' as const }, idempotencyKey: 'compose-0001' };

  it('accepts a well-formed announcement', () => {
    expect(contestAnnouncementInputSchema.safeParse(base).success).toBe(true);
  });

  it('requires a non-empty subject and a non-empty body', () => {
    expect(contestAnnouncementInputSchema.safeParse({ ...base, subject: '   ' }).success).toBe(false);
    expect(contestAnnouncementInputSchema.safeParse({ ...base, bodyBlocks: [] }).success).toBe(false);
  });

  // Header injection: a bare \r or \n in a subject can split headers on a
  // transport that does not encode them. Reject at the edge, not in the adapter.
  it('rejects CR or LF anywhere in the subject', () => {
    expect(contestAnnouncementInputSchema.safeParse({ ...base, subject: 'Hi\nBcc: evil@example.com' }).success).toBe(false);
    expect(contestAnnouncementInputSchema.safeParse({ ...base, subject: 'Hi\rBcc: evil@example.com' }).success).toBe(false);
    expect(contestAnnouncementInputSchema.safeParse({ ...base, subject: 'Hi\r\nBcc: evil@example.com' }).success).toBe(false);
  });

  it('caps the subject length and the block count', () => {
    expect(contestAnnouncementInputSchema.safeParse({ ...base, subject: 'x'.repeat(201) }).success).toBe(false);
    expect(contestAnnouncementInputSchema.safeParse({ ...base, bodyBlocks: Array.from({ length: 201 }, () => ['paragraph', {}]) }).success).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(contestAnnouncementInputSchema.safeParse({ ...base, scheduledAt: '2030-01-01' }).success).toBe(false);
  });

  // Without a key a double-clicked send mails the whole audience twice, so the
  // guard must be impossible to forget rather than merely available.
  it('requires an idempotency key long enough not to collide by accident', () => {
    const noKey: Record<string, unknown> = { ...base };
    delete noKey.idempotencyKey;
    expect(contestAnnouncementInputSchema.safeParse(noKey).success).toBe(false);
    expect(contestAnnouncementInputSchema.safeParse({ ...base, idempotencyKey: 'short' }).success).toBe(false);
    expect(contestAnnouncementInputSchema.safeParse({ ...base, idempotencyKey: 'x'.repeat(65) }).success).toBe(false);
  });
});

describe('contestAnnouncementPreviewSchema', () => {
  it('accepts subject + body without an audience (preview does not send)', () => {
    expect(contestAnnouncementPreviewSchema.safeParse({ subject: 'Hello', bodyBlocks: BLOCKS }).success).toBe(true);
  });

  it('applies the same subject guards as the send', () => {
    expect(contestAnnouncementPreviewSchema.safeParse({ subject: 'a\nb', bodyBlocks: BLOCKS }).success).toBe(false);
  });

  it('allows an empty body so the editor can preview while still composing', () => {
    expect(contestAnnouncementPreviewSchema.safeParse({ subject: 'Hello', bodyBlocks: [] }).success).toBe(true);
  });
});

describe('contestAnnouncementTestSchema', () => {
  const base = { subject: 'Hello', bodyBlocks: BLOCKS };

  it('requires exactly one recipient (email XOR user)', () => {
    expect(contestAnnouncementTestSchema.safeParse(base).success).toBe(false);
    expect(contestAnnouncementTestSchema.safeParse({ ...base, toEmail: 'a@b.com', toUserId: '00000000-0000-0000-0000-000000000000' }).success).toBe(false);
    expect(contestAnnouncementTestSchema.safeParse({ ...base, toEmail: 'a@b.com' }).success).toBe(true);
    expect(contestAnnouncementTestSchema.safeParse({ ...base, toUserId: '00000000-0000-0000-0000-000000000000' }).success).toBe(true);
  });

  it('rejects a malformed email or non-uuid user', () => {
    expect(contestAnnouncementTestSchema.safeParse({ ...base, toEmail: 'nope' }).success).toBe(false);
    expect(contestAnnouncementTestSchema.safeParse({ ...base, toUserId: 'nope' }).success).toBe(false);
  });
});
