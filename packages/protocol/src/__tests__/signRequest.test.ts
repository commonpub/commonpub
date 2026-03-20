import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateKeypair,
  exportPublicKeyPem,
  exportPrivateKeyPem,
  verifyHttpSignature,
} from '../index';
import { signRequest } from '../sign';

describe('signRequest', () => {
  let publicKeyPem: string;
  let privateKeyPem: string;

  beforeAll(async () => {
    const keypair = await generateKeypair();
    publicKeyPem = await exportPublicKeyPem(keypair);
    privateKeyPem = await exportPrivateKeyPem(keypair);
  });

  it('adds Signature header to a POST request', async () => {
    const request = new Request('https://remote.test/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/activity+json' },
      body: JSON.stringify({ type: 'Follow' }),
    });

    const signed = await signRequest(
      request,
      privateKeyPem,
      'https://local.test/users/alice#main-key',
    );

    expect(signed.headers.get('signature')).toBeDefined();
    expect(signed.headers.get('date')).toBeDefined();
    expect(signed.headers.get('digest')).toBeDefined();
  });

  it('includes keyId in Signature header', async () => {
    const request = new Request('https://remote.test/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/activity+json' },
      body: JSON.stringify({ type: 'Follow' }),
    });

    const keyId = 'https://local.test/users/alice#main-key';
    const signed = await signRequest(request, privateKeyPem, keyId);

    const sig = signed.headers.get('signature')!;
    expect(sig).toContain(`keyId="${keyId}"`);
  });

  it('produces a signature that verifies with the corresponding public key', async () => {
    const body = JSON.stringify({ type: 'Create', actor: 'https://local.test/users/alice' });
    const request = new Request('https://remote.test/users/bob/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/activity+json' },
      body,
    });

    const signed = await signRequest(
      request,
      privateKeyPem,
      'https://local.test/users/alice#main-key',
    );

    const result = await verifyHttpSignature(signed, publicKeyPem);
    expect(result).toBe(true);
  });

  it('fails verification with wrong public key', { timeout: 15000 }, async () => {
    const body = JSON.stringify({ type: 'Follow' });
    const request = new Request('https://remote.test/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/activity+json' },
      body,
    });

    const signed = await signRequest(
      request,
      privateKeyPem,
      'https://local.test/users/alice#main-key',
    );

    // Generate a different keypair (RSA keygen can be slow)
    const otherKeypair = await generateKeypair();
    const otherPublicKey = await exportPublicKeyPem(otherKeypair);

    const result = await verifyHttpSignature(signed, otherPublicKey);
    expect(result).toBe(false);
  });

  it('produces different Digest for different bodies', async () => {
    const body1 = JSON.stringify({ type: 'Follow', actor: 'https://local.test/users/alice' });
    const body2 = JSON.stringify({ type: 'Delete', actor: 'https://evil.test/users/mallory' });

    const req1 = new Request('https://remote.test/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/activity+json' },
      body: body1,
    });
    const req2 = new Request('https://remote.test/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/activity+json' },
      body: body2,
    });

    const signed1 = await signRequest(req1, privateKeyPem, 'https://local.test/users/alice#main-key');
    const signed2 = await signRequest(req2, privateKeyPem, 'https://local.test/users/alice#main-key');

    // Different bodies produce different Digest headers
    expect(signed1.headers.get('digest')).not.toBe(signed2.headers.get('digest'));
    // And therefore different signatures (since digest is in the signing string)
    expect(signed1.headers.get('signature')).not.toBe(signed2.headers.get('signature'));
  });

  it('fails verification when body is tampered (digest mismatch)', async () => {
    const body = JSON.stringify({ type: 'Follow', actor: 'https://local.test/users/alice' });
    const request = new Request('https://remote.test/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/activity+json' },
      body,
    });

    const signed = await signRequest(
      request,
      privateKeyPem,
      'https://local.test/users/alice#main-key',
    );

    // Tamper with body but keep same headers (including original Digest)
    const tamperedBody = JSON.stringify({ type: 'Delete', actor: 'https://evil.test/users/mallory' });
    const tampered = new Request(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: tamperedBody,
    });

    // Digest verification catches the tampered body
    const result = await verifyHttpSignature(tampered, publicKeyPem);
    expect(result).toBe(false);
  });

  it('handles GET requests (no Digest header)', async () => {
    const request = new Request('https://remote.test/users/bob', {
      method: 'GET',
      headers: { Accept: 'application/activity+json' },
    });

    const signed = await signRequest(
      request,
      privateKeyPem,
      'https://local.test/users/alice#main-key',
    );

    expect(signed.headers.get('signature')).toBeDefined();
    expect(signed.headers.get('date')).toBeDefined();
    // GET requests don't have a body, so digest behavior depends on implementation
  });

  it('passes verification with tampered body when digest verification disabled', async () => {
    const body = JSON.stringify({ type: 'Follow' });
    const request = new Request('https://remote.test/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/activity+json' },
      body,
    });

    const signed = await signRequest(request, privateKeyPem, 'https://local.test/users/alice#main-key');

    const tampered = new Request(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: JSON.stringify({ type: 'Malicious' }),
    });

    // With digest verification disabled, tampered body is NOT caught
    // (only the Signature header is verified, which covers the old Digest)
    const result = await verifyHttpSignature(tampered, publicKeyPem, { verifyDigest: false });
    expect(result).toBe(true);
  });

  it('GET requests skip digest verification by default', async () => {
    const request = new Request('https://remote.test/users/bob', {
      method: 'GET',
      headers: { Accept: 'application/activity+json' },
    });

    const signed = await signRequest(request, privateKeyPem, 'https://local.test/users/alice#main-key');

    // GET has no body, so digest verification is skipped
    const result = await verifyHttpSignature(signed, publicKeyPem);
    expect(result).toBe(true);
  });

  it('includes Host header in signed request', async () => {
    const request = new Request('https://remote.test/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/activity+json' },
      body: JSON.stringify({ type: 'Follow' }),
    });

    const signed = await signRequest(request, privateKeyPem, 'https://local.test/users/alice#main-key');

    expect(signed.headers.get('host')).toBe('remote.test');
    // Signature header should reference host in signed headers list
    const sig = signed.headers.get('signature')!;
    expect(sig).toContain('host');
  });

  it('preserves existing Date header', async () => {
    const existingDate = 'Thu, 20 Mar 2026 12:00:00 GMT';
    const request = new Request('https://remote.test/inbox', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/activity+json',
        Date: existingDate,
      },
      body: JSON.stringify({ type: 'Follow' }),
    });

    const signed = await signRequest(
      request,
      privateKeyPem,
      'https://local.test/users/alice#main-key',
    );

    expect(signed.headers.get('date')).toBe(existingDate);
  });
});
