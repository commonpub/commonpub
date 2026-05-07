/**
 * ChaCha20-Poly1305 token encryption for cross-instance OAuth tokens.
 *
 * Used by Phase 1+ of the cross-instance identity work
 * (docs/sessions/136-cross-instance-identity-plan.md) to encrypt access
 * tokens at rest in `federated_accounts`. Plain tokens are never written
 * to disk; a database dump without the encryption key is useless.
 *
 * Storage shape (in `federated_accounts`):
 *   - access_token_ciphertext: base64(ciphertext || authTag)
 *   - access_token_iv:         base64(iv)  // 12 bytes per row
 *
 * Key:  CPUB_FED_TOKEN_KEY env var, 64 hex chars (32 bytes / 256 bits).
 * Generate with: `openssl rand -hex 32`.
 *
 * Algorithm: ChaCha20-Poly1305 (RFC 8439). Authenticated encryption with
 * associated data (AEAD); auth tag is 16 bytes. Tampering on either
 * ciphertext or IV causes decryption to throw.
 *
 * Key rotation: re-encrypt every row with the new key, then swap the env
 * var atomically. Old ciphertexts under the previous key cannot be
 * decrypted after the swap — plan the migration before flipping it.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'chacha20-poly1305';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

const KEY_ENV = 'CPUB_FED_TOKEN_KEY';

export interface EncryptedToken {
  /** base64(ciphertext || authTag) */
  ciphertext: string;
  /** base64(iv) */
  iv: string;
}

/**
 * Read the encryption key from CPUB_FED_TOKEN_KEY. Throws if unset or
 * malformed. Returned key is a fresh Buffer per call (no shared mutable
 * state).
 */
function readKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex) {
    throw new Error(
      `${KEY_ENV} env var must be set to use token encryption. ` +
      `Generate one with: openssl rand -hex 32`,
    );
  }
  if (hex.length !== KEY_BYTES * 2) {
    throw new Error(
      `${KEY_ENV} must be exactly ${KEY_BYTES * 2} hex chars ` +
      `(got ${hex.length})`,
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`${KEY_ENV} must be hex characters only`);
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext token. Generates a fresh random IV per call —
 * ChaCha20-Poly1305 requires unique IVs per (key, message); reusing an
 * IV would catastrophically leak plaintext, so always call this fresh.
 */
export function encryptToken(plaintext: string): EncryptedToken {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encryptToken: plaintext must be a string');
  }
  const key = readKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Bundle tag with ciphertext so callers store one blob, not two.
  // Layout: [ciphertext...][16-byte tag]
  const combined = Buffer.concat([ct, tag]);
  return {
    ciphertext: combined.toString('base64'),
    iv: iv.toString('base64'),
  };
}

/**
 * Decrypt an EncryptedToken. Throws if the auth tag check fails — i.e.,
 * if the ciphertext, IV, or auth tag has been tampered with, or if the
 * key has changed since encryption.
 */
export function decryptToken(encrypted: EncryptedToken): string {
  if (!encrypted || typeof encrypted.ciphertext !== 'string' || typeof encrypted.iv !== 'string') {
    throw new TypeError('decryptToken: input must be { ciphertext, iv } strings');
  }
  const key = readKey();
  const iv = Buffer.from(encrypted.iv, 'base64');
  if (iv.length !== IV_BYTES) {
    throw new Error(`decryptToken: iv must be ${IV_BYTES} bytes, got ${iv.length}`);
  }
  const combined = Buffer.from(encrypted.ciphertext, 'base64');
  if (combined.length < TAG_BYTES) {
    throw new Error('decryptToken: ciphertext too short to contain auth tag');
  }
  const tagOffset = combined.length - TAG_BYTES;
  const ct = combined.subarray(0, tagOffset);
  const tag = combined.subarray(tagOffset);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/**
 * True iff CPUB_FED_TOKEN_KEY is set and well-formed. Use at startup to
 * decide whether to enable token-storing identity features. Never logs
 * the key value.
 */
export function isTokenKeyConfigured(): boolean {
  try {
    readKey();
    return true;
  } catch {
    return false;
  }
}
