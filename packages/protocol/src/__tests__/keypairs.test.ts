import { describe, it, expect } from 'vitest';
import { generateKeypair, exportPublicKeyPem, exportPrivateKeyPem, buildKeyId } from '../keypairs';

describe('generateKeypair', () => {
  it('should generate an RSA 2048 keypair', async () => {
    const keypair = await generateKeypair();
    expect(keypair).toBeDefined();
    expect(keypair.publicKey).toBeDefined();
    expect(keypair.privateKey).toBeDefined();
  });

  it('should generate different keypairs each time', { timeout: 15000 }, async () => {
    const kp1 = await generateKeypair();
    const kp2 = await generateKeypair();
    const pub1 = await exportPublicKeyPem(kp1);
    const pub2 = await exportPublicKeyPem(kp2);
    expect(pub1).not.toBe(pub2);
  });
});

describe('exportPublicKeyPem', () => {
  it('should export public key in PEM format', async () => {
    const keypair = await generateKeypair();
    const pem = await exportPublicKeyPem(keypair);
    expect(pem).toContain('-----BEGIN PUBLIC KEY-----');
    expect(pem).toContain('-----END PUBLIC KEY-----');
  });
});

describe('exportPrivateKeyPem', () => {
  it('should export private key in PEM format', async () => {
    const keypair = await generateKeypair();
    const pem = await exportPrivateKeyPem(keypair);
    expect(pem).toContain('-----BEGIN PRIVATE KEY-----');
    expect(pem).toContain('-----END PRIVATE KEY-----');
  });
});

describe('buildKeyId', () => {
  it('should format key ID as domain/users/username#main-key', () => {
    const keyId = buildKeyId('example.com', 'alice');
    expect(keyId).toBe('https://example.com/users/alice#main-key');
  });

  it('should handle special characters in username', () => {
    const keyId = buildKeyId('example.com', 'bob-123');
    expect(keyId).toBe('https://example.com/users/bob-123#main-key');
  });
});
