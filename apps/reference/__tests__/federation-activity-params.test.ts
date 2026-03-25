import { describe, it, expect } from 'vitest';

const VALID_DIRECTIONS = ['inbound', 'outbound'] as const;
const VALID_STATUSES = ['pending', 'delivered', 'failed', 'processed'] as const;

// Mirror the validation logic from server/api/admin/federation/activity.get.ts
function validateFederationParams(query: Record<string, string | undefined>) {
  const direction = VALID_DIRECTIONS.includes(query.direction as typeof VALID_DIRECTIONS[number])
    ? (query.direction as 'inbound' | 'outbound')
    : undefined;

  const status = VALID_STATUSES.includes(query.status as typeof VALID_STATUSES[number])
    ? (query.status as 'pending' | 'delivered' | 'failed' | 'processed')
    : undefined;

  const limit = Math.max(1, Math.min(100, parseInt(query.limit as string, 10) || 50));
  const offset = Math.max(0, parseInt(query.offset as string, 10) || 0);

  return { direction, status, limit, offset, type: typeof query.type === 'string' ? query.type : undefined };
}

describe('federation activity query params', () => {
  it('accepts valid direction', () => {
    expect(validateFederationParams({ direction: 'inbound' }).direction).toBe('inbound');
    expect(validateFederationParams({ direction: 'outbound' }).direction).toBe('outbound');
  });

  it('rejects invalid direction', () => {
    expect(validateFederationParams({ direction: 'DROP TABLE' }).direction).toBeUndefined();
    expect(validateFederationParams({ direction: '' }).direction).toBeUndefined();
  });

  it('accepts valid status', () => {
    expect(validateFederationParams({ status: 'pending' }).status).toBe('pending');
    expect(validateFederationParams({ status: 'delivered' }).status).toBe('delivered');
  });

  it('rejects invalid status', () => {
    expect(validateFederationParams({ status: 'hacked' }).status).toBeUndefined();
  });

  it('defaults limit to 50', () => {
    expect(validateFederationParams({}).limit).toBe(50);
  });

  it('clamps limit to 1-100', () => {
    expect(validateFederationParams({ limit: '0' }).limit).toBe(50);
    expect(validateFederationParams({ limit: '-5' }).limit).toBe(1);
    expect(validateFederationParams({ limit: '999' }).limit).toBe(100);
    expect(validateFederationParams({ limit: 'abc' }).limit).toBe(50);
    expect(validateFederationParams({ limit: '25' }).limit).toBe(25);
  });

  it('defaults offset to 0', () => {
    expect(validateFederationParams({}).offset).toBe(0);
  });

  it('clamps offset to non-negative', () => {
    expect(validateFederationParams({ offset: '-10' }).offset).toBe(0);
    expect(validateFederationParams({ offset: 'abc' }).offset).toBe(0);
  });

  it('passes through valid type', () => {
    expect(validateFederationParams({ type: 'Follow' }).type).toBe('Follow');
  });

  it('rejects non-string type', () => {
    expect(validateFederationParams({}).type).toBeUndefined();
  });
});
