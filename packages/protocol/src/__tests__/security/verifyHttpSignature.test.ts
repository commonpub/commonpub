/**
 * Federation-hardening Stage 3 (Items 6 + 7) — verifyHttpSignature
 * coverage policy + raw-body digest contract.
 *
 * Tests use real keypairs via signRequest to produce signed requests,
 * then verify the various failure modes that the strict policy must
 * reject. Fixture-only; no network, no real fediverse interop.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import {
  generateKeypair,
  exportPublicKeyPem,
  exportPrivateKeyPem,
  buildKeyId,
  verifyHttpSignature,
} from '../../keypairs';
import { signRequest } from '../../sign';

interface Fixture {
  privateKeyPem: string;
  publicKeyPem: string;
  keyId: string;
}

let fx: Fixture;

beforeAll(async () => {
  const keypair = await generateKeypair();
  const privateKeyPem = await exportPrivateKeyPem(keypair);
  const publicKeyPem = await exportPublicKeyPem(keypair);
  const keyId = buildKeyId('alice.example', 'alice');
  fx = { privateKeyPem, publicKeyPem, keyId };
}, 30000);

const INBOX_URL = 'https://us.example/inbox';

function buildRequest(body: string, extraHeaders?: Record<string, string>): Request {
  return new Request(INBOX_URL, {
    method: 'POST',
    headers: {
      host: 'us.example',
      'content-type': 'application/activity+json',
      ...(extraHeaders ?? {}),
    },
    body,
  });
}

describe('verifyHttpSignature — happy path', () => {
  it('accepts a correctly-signed POST with body + digest', async () => {
    const req = buildRequest('{"type":"Create","object":{"content":"hi"}}');
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);
    expect(await verifyHttpSignature(signed, fx.publicKeyPem)).toBe(true);
  });
});

describe('verifyHttpSignature — Item 6 raw-body digest', () => {
  it('verifies digest against ORIGINAL raw bytes (whitespace preserved)', async () => {
    // The body has trailing whitespace + a newline — re-serialization would
    // canonicalize it and drop the suffix, breaking digest comparison.
    const rawBody = '{"type":"Create","object":{"content":"hi"}}   \n';
    const req = buildRequest(rawBody);
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);
    expect(await verifyHttpSignature(signed, fx.publicKeyPem)).toBe(true);
  });

  it('rejects when raw body differs from the digested bytes (tampered body)', async () => {
    const original = '{"type":"Create","object":{"content":"hi"}}';
    const req = buildRequest(original);
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);

    // Same headers (incl. digest of `original`), but the body bytes were
    // replaced — exactly the body-tampering attack the digest defends against.
    const tampered = new Request(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: '{"type":"Create","object":{"content":"REPLACED"}}',
    });
    expect(await verifyHttpSignature(tampered, fx.publicKeyPem)).toBe(false);
  });

  it('rejects when the digest header itself was changed', async () => {
    const req = buildRequest('{"x":1}');
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);

    const headers = new Headers(signed.headers);
    headers.set('digest', 'SHA-256=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    const broken = new Request(signed.url, {
      method: 'POST',
      headers,
      body: '{"x":1}',
    });
    expect(await verifyHttpSignature(broken, fx.publicKeyPem)).toBe(false);
  });
});

describe('verifyHttpSignature — Item 7 coverage policy', () => {
  // Helper: tweak the Signature header's headers= parameter only.
  function withSignedHeaders(req: Request, newHeadersValue: string): Request {
    const sig = req.headers.get('signature')!;
    const tweaked = sig.replace(/headers="[^"]*"/, `headers="${newHeadersValue}"`);
    const headers = new Headers(req.headers);
    headers.set('signature', tweaked);
    return new Request(req.url, { method: 'POST', headers, body: '{"x":1}' });
  }

  it('rejects when the Signature header has no `headers=` parameter at all', async () => {
    const req = buildRequest('{"x":1}');
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);

    const sig = signed.headers.get('signature')!;
    const stripped = sig.replace(/headers="[^"]*",?/, '');
    const headers = new Headers(signed.headers);
    headers.set('signature', stripped);
    const noHeadersParam = new Request(signed.url, { method: 'POST', headers, body: '{"x":1}' });
    expect(await verifyHttpSignature(noHeadersParam, fx.publicKeyPem)).toBe(false);
  });

  it('rejects when (request-target) is missing from signed set', async () => {
    const req = buildRequest('{"x":1}');
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);
    const evil = withSignedHeaders(signed, 'host date digest');
    expect(await verifyHttpSignature(evil, fx.publicKeyPem)).toBe(false);
  });

  it('rejects when host is missing from signed set', async () => {
    const req = buildRequest('{"x":1}');
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);
    const evil = withSignedHeaders(signed, '(request-target) date digest');
    expect(await verifyHttpSignature(evil, fx.publicKeyPem)).toBe(false);
  });

  it('rejects when date is missing from signed set', async () => {
    const req = buildRequest('{"x":1}');
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);
    const evil = withSignedHeaders(signed, '(request-target) host digest');
    expect(await verifyHttpSignature(evil, fx.publicKeyPem)).toBe(false);
  });

  it('rejects when body is non-empty but digest is NOT in signed set', async () => {
    const req = buildRequest('{"x":1}');
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);
    // Attacker drops digest from coverage so they can swap the body
    // without invalidating the signature. Must be rejected.
    const evil = withSignedHeaders(signed, '(request-target) host date');
    expect(await verifyHttpSignature(evil, fx.publicKeyPem)).toBe(false);
  });

  it('rejects when the Date HTTP header is missing', async () => {
    const req = buildRequest('{"x":1}');
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);
    const headers = new Headers(signed.headers);
    headers.delete('date');
    const noDate = new Request(signed.url, { method: 'POST', headers, body: '{"x":1}' });
    expect(await verifyHttpSignature(noDate, fx.publicKeyPem)).toBe(false);
  });

  it('rejects when no Signature header is present', async () => {
    const req = buildRequest('{"x":1}');
    // Unsigned request — must be rejected.
    expect(await verifyHttpSignature(req, fx.publicKeyPem)).toBe(false);
  });

  it('rejects when signature= parameter is missing', async () => {
    const req = buildRequest('{"x":1}');
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);
    const sig = signed.headers.get('signature')!;
    const stripped = sig.replace(/,signature="[^"]+"/, '');
    const headers = new Headers(signed.headers);
    headers.set('signature', stripped);
    const noSig = new Request(signed.url, { method: 'POST', headers, body: '{"x":1}' });
    expect(await verifyHttpSignature(noSig, fx.publicKeyPem)).toBe(false);
  });
});

describe('verifyHttpSignature — wrong key', () => {
  it('rejects when verified against a different actor public key', async () => {
    const req = buildRequest('{"x":1}');
    const signed = await signRequest(req, fx.privateKeyPem, fx.keyId);

    const otherKeypair = await generateKeypair();
    const otherPublicKey = await exportPublicKeyPem(otherKeypair);
    expect(await verifyHttpSignature(signed, otherPublicKey)).toBe(false);
  }, 30000);
});
