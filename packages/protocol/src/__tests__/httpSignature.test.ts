import { describe, it, expect } from 'vitest';
import { verifyHttpSignature, generateKeypair, exportPublicKeyPem } from '../index';

describe('verifyHttpSignature', () => {
  it('returns false when no Signature header is present', async () => {
    const request = new Request('https://example.com/inbox', {
      method: 'POST',
      body: '{}',
    });
    const result = await verifyHttpSignature(request, 'some-key');
    expect(result).toBe(false);
  });

  it('returns false for malformed signature header', async () => {
    const request = new Request('https://example.com/inbox', {
      method: 'POST',
      headers: {
        signature: 'garbage-data',
      },
      body: '{}',
    });
    const result = await verifyHttpSignature(request, 'some-key');
    expect(result).toBe(false);
  });

  it('returns false for invalid signature', async () => {
    const request = new Request('https://example.com/inbox', {
      method: 'POST',
      headers: {
        signature: 'keyId="https://remote.example/users/alice#main-key",headers="(request-target) host date",signature="aW52YWxpZA=="',
        host: 'example.com',
        date: new Date().toUTCString(),
      },
      body: '{}',
    });

    const keypair = await generateKeypair();
    const publicKeyPem = await exportPublicKeyPem(keypair);

    const result = await verifyHttpSignature(request, publicKeyPem);
    expect(result).toBe(false);
  });
});
