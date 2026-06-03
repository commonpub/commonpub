/**
 * Tests for `assertActorMatchesSigner` — binds an inbound activity's `actor` to the verified HTTP
 * signature signer (anti-spoofing). `createError` is a Nitro auto-import the util references as a
 * global; install a stand-in on globalThis (the layer vitest env resolves free identifiers from
 * globalThis), then import the util after.
 */
import { describe, it, expect, beforeAll } from 'vitest';

interface HttpError extends Error {
  statusCode: number;
  statusMessage: string;
}

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.createError = (opts: { statusCode: number; statusMessage: string }): HttpError => {
    const e = new Error(opts.statusMessage) as HttpError;
    e.statusCode = opts.statusCode;
    e.statusMessage = opts.statusMessage;
    return e;
  };
});

const { assertActorMatchesSigner } = await import('../inbox');

const SIGNER = 'https://remote.example/actor';

describe('assertActorMatchesSigner', () => {
  it('accepts an activity whose actor is on the same host as the signer', () => {
    expect(() => assertActorMatchesSigner(SIGNER, { actor: 'https://remote.example/users/bob' }, 't')).not.toThrow();
    expect(() => assertActorMatchesSigner(SIGNER, { actor: SIGNER }, 't')).not.toThrow();
  });

  it('rejects an activity whose actor is on a DIFFERENT host (spoofing)', () => {
    expect(() => assertActorMatchesSigner(SIGNER, { actor: 'https://victim.example/actor' }, 't'))
      .toThrow(/does not match request signer/);
  });

  it('accepts an actor expressed as an object with a same-host id', () => {
    expect(() => assertActorMatchesSigner(SIGNER, { actor: { id: 'https://remote.example/actor' } }, 't')).not.toThrow();
  });

  it('rejects an object actor whose id is a different host', () => {
    expect(() => assertActorMatchesSigner(SIGNER, { actor: { id: 'https://victim.example/actor' } }, 't'))
      .toThrow(/does not match request signer/);
  });

  it('no-ops when actor is absent (processInboxActivity rejects missing actor itself)', () => {
    expect(() => assertActorMatchesSigner(SIGNER, {}, 't')).not.toThrow();
  });

  it('rejects a malformed actor URI', () => {
    expect(() => assertActorMatchesSigner(SIGNER, { actor: 'not a url' }, 't')).toThrow(/Invalid activity actor/);
  });
});
