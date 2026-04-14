import { describe, it, expect } from 'vitest';
import {
  adminSettingSchema,
  adminUpdateRoleSchema,
  adminUpdateStatusSchema,
  resolveReportSchema,
} from '../validators';

describe('adminSettingSchema', () => {
  it('accepts valid setting with string value', () => {
    const result = adminSettingSchema.safeParse({ key: 'theme.default', value: 'agora' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.key).toBe('theme.default');
      expect(result.data.value).toBe('agora');
    }
  });

  it('accepts any value type (boolean, number, object)', () => {
    expect(adminSettingSchema.safeParse({ key: 'flag', value: true }).success).toBe(true);
    expect(adminSettingSchema.safeParse({ key: 'count', value: 42 }).success).toBe(true);
    expect(adminSettingSchema.safeParse({ key: 'obj', value: { nested: true } }).success).toBe(true);
    expect(adminSettingSchema.safeParse({ key: 'null', value: null }).success).toBe(true);
  });

  it('rejects empty key', () => {
    expect(adminSettingSchema.safeParse({ key: '', value: 'x' }).success).toBe(false);
  });

  it('rejects key over 128 chars', () => {
    expect(adminSettingSchema.safeParse({ key: 'a'.repeat(129), value: 'x' }).success).toBe(false);
  });

  it('accepts key at boundary length', () => {
    expect(adminSettingSchema.safeParse({ key: 'k', value: 'x' }).success).toBe(true);
    expect(adminSettingSchema.safeParse({ key: 'a'.repeat(128), value: 'x' }).success).toBe(true);
  });

  it('rejects missing key', () => {
    expect(adminSettingSchema.safeParse({ value: 'x' }).success).toBe(false);
  });
});

describe('adminUpdateRoleSchema', () => {
  const validRoles = ['member', 'pro', 'verified', 'staff', 'admin'] as const;

  it.each(validRoles)('accepts role: %s', (role) => {
    const result = adminUpdateRoleSchema.safeParse({ role });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe(role);
  });

  it('rejects invalid roles', () => {
    expect(adminUpdateRoleSchema.safeParse({ role: 'superadmin' }).success).toBe(false);
    expect(adminUpdateRoleSchema.safeParse({ role: 'owner' }).success).toBe(false);
    expect(adminUpdateRoleSchema.safeParse({ role: 'moderator' }).success).toBe(false);
    expect(adminUpdateRoleSchema.safeParse({ role: '' }).success).toBe(false);
  });

  it('rejects empty object', () => {
    expect(adminUpdateRoleSchema.safeParse({}).success).toBe(false);
  });

  it('returns parsed role value on success', () => {
    const result = adminUpdateRoleSchema.safeParse({ role: 'staff' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe('staff');
  });
});

describe('adminUpdateStatusSchema', () => {
  const validStatuses = ['active', 'suspended', 'deleted'] as const;

  it.each(validStatuses)('accepts status: %s', (status) => {
    const result = adminUpdateStatusSchema.safeParse({ status });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe(status);
  });

  it('rejects invalid statuses', () => {
    expect(adminUpdateStatusSchema.safeParse({ status: 'banned' }).success).toBe(false);
    expect(adminUpdateStatusSchema.safeParse({ status: 'pending' }).success).toBe(false);
    expect(adminUpdateStatusSchema.safeParse({ status: '' }).success).toBe(false);
  });

  it('rejects empty object', () => {
    expect(adminUpdateStatusSchema.safeParse({}).success).toBe(false);
  });
});

describe('resolveReportSchema', () => {
  it('accepts valid resolution', () => {
    const result = resolveReportSchema.safeParse({
      status: 'resolved',
      resolution: 'Content removed per community guidelines.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('resolved');
      expect(result.data.resolution).toBe('Content removed per community guidelines.');
    }
  });

  it('accepts dismissed status', () => {
    const result = resolveReportSchema.safeParse({
      status: 'dismissed',
      resolution: 'Report was without merit.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts reviewed status', () => {
    const result = resolveReportSchema.safeParse({
      status: 'reviewed',
      resolution: 'Under investigation.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    expect(resolveReportSchema.safeParse({
      status: 'pending',
      resolution: 'Something.',
    }).success).toBe(false);
  });

  it('rejects empty resolution', () => {
    expect(resolveReportSchema.safeParse({
      status: 'resolved',
      resolution: '',
    }).success).toBe(false);
  });

  it('rejects resolution over 2000 chars', () => {
    expect(resolveReportSchema.safeParse({
      status: 'resolved',
      resolution: 'a'.repeat(2001),
    }).success).toBe(false);
  });

  it('accepts resolution at boundary length', () => {
    expect(resolveReportSchema.safeParse({
      status: 'resolved',
      resolution: 'a'.repeat(2000),
    }).success).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(resolveReportSchema.safeParse({}).success).toBe(false);
    expect(resolveReportSchema.safeParse({ status: 'resolved' }).success).toBe(false);
    expect(resolveReportSchema.safeParse({ resolution: 'text' }).success).toBe(false);
  });
});
