import { describe, it, expect } from 'vitest';
import { makeUnsubscribeToken, verifyUnsubscribeToken } from '../comms/unsubscribe.js';

// Email Phase 1b: stateless HMAC unsubscribe tokens.

const SECRET = 'test-secret-abc';
const UID = '6fc2f04e-44ee-4603-9d3c-e1c238dc4e18';

describe('unsubscribe tokens', () => {
  it('round-trips a valid token back to the userId', () => {
    const token = makeUnsubscribeToken(UID, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(UID);
  });

  it('rejects a token signed with a different secret', () => {
    const token = makeUnsubscribeToken(UID, SECRET);
    expect(verifyUnsubscribeToken(token, 'other-secret')).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const token = makeUnsubscribeToken(UID, SECRET);
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    expect(verifyUnsubscribeToken(tampered, SECRET)).toBeNull();
  });

  it('rejects a swapped-id token (id changed, signature kept)', () => {
    const token = makeUnsubscribeToken(UID, SECRET);
    const sig = token.slice(token.indexOf('.'));
    const otherIdB64 = Buffer.from('different-user-id', 'utf8').toString('base64url');
    expect(verifyUnsubscribeToken(otherIdB64 + sig, SECRET)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyUnsubscribeToken('', SECRET)).toBeNull();
    expect(verifyUnsubscribeToken('nodot', SECRET)).toBeNull();
    expect(verifyUnsubscribeToken('.onlysig', SECRET)).toBeNull();
  });
});
