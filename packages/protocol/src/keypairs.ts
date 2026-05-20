import { generateKeyPair, exportSPKI, exportPKCS8, importSPKI } from 'jose';

export interface ActorKeypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/** Generate an RSA 2048 keypair for HTTP Signatures */
export async function generateKeypair(): Promise<ActorKeypair> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    modulusLength: 2048,
    extractable: true,
  });
  return { publicKey, privateKey };
}

/** Export public key as SPKI PEM */
export async function exportPublicKeyPem(keypair: ActorKeypair): Promise<string> {
  return exportSPKI(keypair.publicKey);
}

/** Export private key as PKCS8 PEM */
export async function exportPrivateKeyPem(keypair: ActorKeypair): Promise<string> {
  return exportPKCS8(keypair.privateKey);
}

/** Build the Key ID URI for an actor's public key */
export function buildKeyId(domain: string, username: string): string {
  return `https://${domain}/users/${username}#main-key`;
}

/**
 * Verify an HTTP Signature on an incoming ActivityPub request
 * (draft-cavage-http-signatures-12, the de facto fediverse standard).
 *
 * Returns true if the signature is valid AND the coverage policy is met.
 * Returns false on missing/invalid Signature header, missing required
 * signed headers, missing/stale digest, or cryptographic failure.
 *
 * **Coverage policy (strict by default — matches Mastodon/Pleroma/Lemmy):**
 * - The `headers=` parameter MUST be present and explicit; no defaults.
 * - `(request-target)`, `host`, and `date` MUST be in the signed set.
 * - If the request body is non-empty, `digest` MUST be in the signed set
 *   AND the digest header value MUST match the SHA-256 of the raw body.
 *
 * **Digest verification (Item 6 fix, session 149):** the body is hashed
 * exactly as received (`request.text()` on a clone of the verify Request);
 * the caller is responsible for building that Request with the ORIGINAL
 * raw bytes from the wire, not a re-serialized JSON copy.
 * `JSON.stringify(JSON.parse(x)) !== x` in general (whitespace, escapes,
 * key ordering), so re-serializing breaks digest comparison even when the
 * sender computed everything correctly.
 */
export async function verifyHttpSignature(
  request: Request,
  publicKeyPem: string,
): Promise<boolean> {
  const signatureHeader = request.headers.get('signature');
  if (!signatureHeader) return false;

  try {
    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(',')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim();
      const value = part.slice(eqIdx + 1).trim().replace(/^"|"$/g, '');
      parts[key] = value;
    }

    const rawHeaders = parts.headers;
    if (!rawHeaders) return false;
    const headers = rawHeaders.split(' ');

    const signature = parts.signature;
    if (!signature) return false;

    // Coverage policy: (request-target), host, date must all be signed.
    for (const required of ['(request-target)', 'host', 'date']) {
      if (!headers.includes(required)) return false;
    }

    // Date header must be present at the HTTP level too (signing-line value
    // is read from `request.headers.get('date')` below; empty would still
    // pass signature math but is meaningless for replay protection).
    if (!request.headers.get('date')) return false;

    // Digest verification + coverage: if body is non-empty, digest MUST
    // be signed AND match the raw body's SHA-256.
    const body = await request.clone().text();
    if (body.length > 0) {
      if (!headers.includes('digest')) return false;
      const digestHeader = request.headers.get('digest');
      if (!digestHeader) return false;
      const bodyBytes = new TextEncoder().encode(body);
      const hashBuffer = await crypto.subtle.digest('SHA-256', bodyBytes);
      const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
      const expectedDigest = `SHA-256=${hashBase64}`;
      if (digestHeader !== expectedDigest) return false;
    }

    const url = new URL(request.url);
    const signingLines: string[] = [];
    for (const header of headers) {
      if (header === '(request-target)') {
        signingLines.push(`(request-target): ${request.method.toLowerCase()} ${url.pathname}`);
      } else if (header === 'host') {
        signingLines.push(`host: ${request.headers.get('host') ?? url.host}`);
      } else {
        const val = request.headers.get(header);
        if (val !== null) signingLines.push(`${header}: ${val}`);
      }
    }
    const signingString = signingLines.join('\n');

    const publicKey = await importSPKI(publicKeyPem, 'RS256');
    const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    const data = new TextEncoder().encode(signingString);

    return await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey as CryptoKey,
      sigBytes,
      data,
    );
  } catch {
    return false;
  }
}
