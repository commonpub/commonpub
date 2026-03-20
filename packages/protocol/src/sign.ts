/**
 * HTTP Signature signing for outbound ActivityPub requests.
 * Implements draft-cavage-http-signatures-12 (the de facto AP standard).
 *
 * Signs: (request-target), host, date, digest (for POST/PUT/PATCH)
 * Algorithm: rsa-sha256
 */
import { importPKCS8 } from 'jose';

/**
 * Sign an outbound HTTP request with HTTP Signatures (draft-cavage-12).
 *
 * @param request - The request to sign (will be cloned, not mutated)
 * @param privateKeyPem - PEM-encoded PKCS8 private key
 * @param keyId - The key ID URI (e.g., "https://domain/users/alice#main-key")
 * @returns A new Request with Signature, Date, and Digest headers added
 */
export async function signRequest(
  request: Request,
  privateKeyPem: string,
  keyId: string,
): Promise<Request> {
  const url = new URL(request.url);
  const method = request.method.toLowerCase();

  // Clone headers so we don't mutate the original
  const headers = new Headers(request.headers);

  // Ensure Date header exists
  if (!headers.has('date')) {
    headers.set('date', new Date().toUTCString());
  }

  // Ensure Host header exists
  if (!headers.has('host')) {
    headers.set('host', url.host);
  }

  // Compute Digest for requests with a body
  let body: string | null = null;
  const headersToSign = ['(request-target)', 'host', 'date'];

  if (method === 'post' || method === 'put' || method === 'patch') {
    body = await request.clone().text();
    const bodyBytes = new TextEncoder().encode(body);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bodyBytes);
    const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    headers.set('digest', `SHA-256=${hashBase64}`);
    headersToSign.push('digest');
  }

  // Build the signing string
  const signingLines: string[] = [];
  for (const header of headersToSign) {
    if (header === '(request-target)') {
      signingLines.push(`(request-target): ${method} ${url.pathname}`);
    } else {
      signingLines.push(`${header}: ${headers.get(header) ?? ''}`);
    }
  }
  const signingString = signingLines.join('\n');

  // Import the private key
  const privateKey = await importPKCS8(privateKeyPem, 'RS256');

  // Sign with RSA-SHA256
  const encoder = new TextEncoder();
  const data = encoder.encode(signingString);
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey as CryptoKey,
    data,
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  // Build the Signature header
  const signatureHeader = [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${headersToSign.join(' ')}"`,
    `signature="${signatureBase64}"`,
  ].join(',');

  headers.set('signature', signatureHeader);

  // Build the new signed request
  const init: RequestInit = {
    method: request.method,
    headers,
  };
  if (body !== null) {
    init.body = body;
  }

  return new Request(request.url, init);
}
