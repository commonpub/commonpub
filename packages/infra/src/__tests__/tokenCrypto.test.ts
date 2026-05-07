import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptToken, decryptToken, isTokenKeyConfigured } from '../tokenCrypto.js';

const VALID_KEY = '0'.repeat(64); // 32-byte zero key (test-only)
const ALT_KEY   = 'f'.repeat(64);

describe('tokenCrypto', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.CPUB_FED_TOKEN_KEY;
    process.env.CPUB_FED_TOKEN_KEY = VALID_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CPUB_FED_TOKEN_KEY;
    else process.env.CPUB_FED_TOKEN_KEY = originalKey;
  });

  describe('encryptToken / decryptToken', () => {
    it('round-trips a typical OAuth bearer token', () => {
      const plain = 'cpub_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';
      const enc = encryptToken(plain);
      expect(typeof enc.ciphertext).toBe('string');
      expect(typeof enc.iv).toBe('string');
      expect(enc.ciphertext).not.toContain(plain);
      expect(decryptToken(enc)).toBe(plain);
    });

    it('round-trips utf-8 multibyte content', () => {
      const plain = '日本語のトークン 🐘 cpub:test';
      expect(decryptToken(encryptToken(plain))).toBe(plain);
    });

    it('round-trips an empty string (corner case)', () => {
      expect(decryptToken(encryptToken(''))).toBe('');
    });

    it('produces a different ciphertext on each call (random IV)', () => {
      const plain = 'sentinel-12345';
      const a = encryptToken(plain);
      const b = encryptToken(plain);
      expect(a.iv).not.toBe(b.iv);
      expect(a.ciphertext).not.toBe(b.ciphertext);
      expect(decryptToken(a)).toBe(plain);
      expect(decryptToken(b)).toBe(plain);
    });
  });

  describe('tamper detection (auth tag)', () => {
    it('throws when ciphertext is mutated', () => {
      const enc = encryptToken('payload');
      const buf = Buffer.from(enc.ciphertext, 'base64');
      buf[0] = buf[0]! ^ 0x01;
      const tampered = { ...enc, ciphertext: buf.toString('base64') };
      expect(() => decryptToken(tampered)).toThrow();
    });

    it('throws when IV is mutated', () => {
      const enc = encryptToken('payload');
      const buf = Buffer.from(enc.iv, 'base64');
      buf[0] = buf[0]! ^ 0x01;
      const tampered = { ...enc, iv: buf.toString('base64') };
      expect(() => decryptToken(tampered)).toThrow();
    });

    it('throws when auth tag is mutated', () => {
      const enc = encryptToken('payload');
      const buf = Buffer.from(enc.ciphertext, 'base64');
      // Auth tag is the last 16 bytes
      buf[buf.length - 1] = buf[buf.length - 1]! ^ 0x01;
      const tampered = { ...enc, ciphertext: buf.toString('base64') };
      expect(() => decryptToken(tampered)).toThrow();
    });

    it('throws when decrypted with a different key', () => {
      const enc = encryptToken('payload');
      process.env.CPUB_FED_TOKEN_KEY = ALT_KEY;
      expect(() => decryptToken(enc)).toThrow();
    });
  });

  describe('key validation', () => {
    it('throws when CPUB_FED_TOKEN_KEY is missing', () => {
      delete process.env.CPUB_FED_TOKEN_KEY;
      expect(() => encryptToken('x')).toThrow(/CPUB_FED_TOKEN_KEY/);
      expect(isTokenKeyConfigured()).toBe(false);
    });

    it('throws when key is the wrong length', () => {
      process.env.CPUB_FED_TOKEN_KEY = '0'.repeat(63); // off by one
      expect(() => encryptToken('x')).toThrow(/64 hex/);
      expect(isTokenKeyConfigured()).toBe(false);
    });

    it('throws when key contains non-hex characters', () => {
      process.env.CPUB_FED_TOKEN_KEY = 'z'.repeat(64);
      expect(() => encryptToken('x')).toThrow(/hex/);
      expect(isTokenKeyConfigured()).toBe(false);
    });

    it('isTokenKeyConfigured returns true for a valid key', () => {
      expect(isTokenKeyConfigured()).toBe(true);
    });
  });

  describe('input validation', () => {
    it('encryptToken rejects non-string input', () => {
      // @ts-expect-error – intentional bad input
      expect(() => encryptToken(123)).toThrow(/string/);
    });

    it('decryptToken rejects malformed input shape', () => {
      // @ts-expect-error – intentional bad input
      expect(() => decryptToken(null)).toThrow();
      // @ts-expect-error – intentional bad input
      expect(() => decryptToken({ ciphertext: 'x' })).toThrow();
    });

    it('decryptToken rejects truncated ciphertext (no room for tag)', () => {
      expect(() => decryptToken({
        ciphertext: Buffer.alloc(8).toString('base64'), // < 16 bytes
        iv: Buffer.alloc(12).toString('base64'),
      })).toThrow(/auth tag/);
    });

    it('decryptToken rejects wrong-size IV', () => {
      const enc = encryptToken('x');
      expect(() => decryptToken({
        ...enc,
        iv: Buffer.alloc(8).toString('base64'),
      })).toThrow(/iv/);
    });
  });
});
